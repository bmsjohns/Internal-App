import type { VenueKey } from "@/lib/config";
import type { BriefTask, Milestone, ShiftEntry } from "@/lib/briefing";
import { fmtMin } from "@/lib/briefing";

// Deputy adapter for the briefing's On Shift + Notes/Tasks sections
// (spec §2/§4). Needs a permanent service-account token — a setup step for
// Ben, not something the app can provision (spec §2). Until the env vars
// below are set, deputyConfigured() is false and the mock supplies data.
//
// The Deputy→venue mapping is derived BY NAME from Deputy's own location
// (Company) records — "Prologue…" → prologue, "Simply…"/"…Bramhall" →
// simply — so connecting Deputy needs no location IDs (Ben's rule).
// DEPUTY_LOCATION_ID_PROLOGUE / DEPUTY_LOCATION_ID_SIMPLY exist only as
// comma-separated overrides if the name matching ever guesses wrong.
//
// ⚠️ UNVERIFIED AGAINST A LIVE ACCOUNT: written to Deputy's documented
// Resource API (POST /api/v1/resource/<Resource>/QUERY), but the exact
// field names in this account (spec §9) must be confirmed on first connect.
//
//   DEPUTY_HOSTNAME   e.g. "simplybooks.eu.deputy.com"
//   DEPUTY_API_TOKEN  permanent token (Deputy docs: "permanent token")

export const deputyConfigured = () => !!(process.env.DEPUTY_HOSTNAME && process.env.DEPUTY_API_TOKEN);

/** Pure normaliser, exported for tests: env values arrive as whatever was
 *  pasted into Vercel — with protocol, trailing slash, a path, or stray
 *  whitespace. A trailing slash alone turns every API URL into //api/…,
 *  which Deputy answers with "404 No method for  found". */
export const normalizeDeputyHost = (raw: string): string =>
  raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.$/, "");

const deputyHost = () => normalizeDeputyHost(process.env.DEPUTY_HOSTNAME ?? "");
const deputyToken = () => (process.env.DEPUTY_API_TOKEN ?? "").trim();

/** Pure matcher, exported for tests: which venue a Deputy location is. */
export function venueForLocationName(name: string): VenueKey | null {
  const n = name.toLowerCase();
  if (n.includes("prologue") || n.includes("weir mill")) return "prologue";
  if (n.includes("simply") || n.includes("bramhall")) return "simply";
  return null;
}

/** Full location matcher: an explicit per-location tag set in Deputy wins
 *  over name guessing. Set the location's External ID (or code) to
 *  "prologue" / "simply" in Deputy's location settings to pin the mapping. */
export function venueForCompany(c: {
  Code?: string | null;
  ExternalId?: string | null;
  CompanyName?: string | null;
  TradingName?: string | null;
}): VenueKey | null {
  for (const tag of [c.ExternalId, c.Code]) {
    const t = (tag ?? "").trim().toLowerCase();
    if (["prologue", "pro", "plg"].includes(t)) return "prologue";
    if (["simply", "sim", "sb"].includes(t)) return "simply";
  }
  return venueForLocationName(`${c.CompanyName ?? ""} ${c.TradingName ?? ""}`);
}

async function deputy(path: string, body?: unknown): Promise<any> {
  const res = await fetch(`https://${deputyHost()}/api/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${deputyToken()}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Deputy ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Location (Company) resolution — cached an hour; shops don't move.
// ---------------------------------------------------------------------------
type CompanyMap = Record<VenueKey, number[]>;
let companyCache: { at: number; map: CompanyMap } | null = null;
const COMPANY_CACHE_MS = 60 * 60 * 1000;

function envOverride(venue: VenueKey): number[] | null {
  const raw =
    venue === "prologue" ? process.env.DEPUTY_LOCATION_ID_PROLOGUE : process.env.DEPUTY_LOCATION_ID_SIMPLY;
  if (!raw) return null;
  return raw.split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
}

async function companies(): Promise<CompanyMap> {
  if (companyCache && Date.now() - companyCache.at < COMPANY_CACHE_MS) return companyCache.map;
  const map: CompanyMap = { prologue: envOverride("prologue") ?? [], simply: envOverride("simply") ?? [] };
  if (map.prologue.length === 0 || map.simply.length === 0) {
    const rows: any[] = await deputy("resource/Company/QUERY", { search: {}, max: 100 });
    for (const c of rows) {
      const venue = venueForCompany(c);
      if (venue && !envOverride(venue)) map[venue].push(c.Id);
    }
    for (const venue of ["prologue", "simply"] as VenueKey[]) {
      if (map[venue].length === 0) {
        console.error(
          `Briefing: no Deputy location matched "${venue}" by name — rename it in Deputy or set the DEPUTY_LOCATION_ID_* override`
        );
      }
    }
  }
  companyCache = { at: Date.now(), map };
  return map;
}

// Spec §2: don't hit Deputy live on every page load — cache for 10 minutes
// and show "as of HH.MM". One entry per date; serverless instances each keep
// their own cache, which only makes refreshes more frequent, never staler.
const CACHE_MS = 10 * 60 * 1000;
interface DayCache {
  at: number;
  asOf: string;
  roster: Record<VenueKey, ShiftEntry[]>;
  tasks: Record<VenueKey, BriefTask[]>;
}
const dayCache = new Map<string, DayCache>();

const asOfNow = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(":", ".");

/** Unix seconds → minutes-from-midnight in London. */
function tsToMin(ts: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ts * 1000));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute");
}

async function fetchDay(date: string): Promise<DayCache> {
  const hit = dayCache.get(date);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;

  const map = await companies();
  const venueOfCompany = (id: number): VenueKey | null =>
    map.prologue.includes(id) ? "prologue" : map.simply.includes(id) ? "simply" : null;

  const roster = { prologue: [], simply: [] } as Record<VenueKey, ShiftEntry[]>;
  const tasks = { prologue: [], simply: [] } as Record<VenueKey, BriefTask[]>;

  // One roster query for the whole day; rows land in a venue via their
  // operational unit's parent location (spec §2 mapping).
  const rows: any[] = await deputy("resource/Roster/QUERY", {
    search: { date: { field: "Date", type: "eq", data: date } },
    join: ["EmployeeObject", "OperationalUnitObject"],
    max: 500,
  });
  for (const r of rows) {
    if (r.Open) continue; // open (unassigned) shifts aren't "who's on"
    const companyId = r.OperationalUnitObject?.Company ?? r.Company;
    const venue = typeof companyId === "number" ? venueOfCompany(companyId) : null;
    if (!venue) continue;
    roster[venue].push({
      id: String(r.Id),
      name: r.EmployeeObject?.DisplayName ?? r._DPMetaData?.EmployeeInfo?.DisplayName ?? "Unassigned",
      role: r.OperationalUnitObject?.OperationalUnitName ?? "",
      startMin: tsToMin(r.StartTime),
      endMin: tsToMin(r.EndTime),
    });
  }
  for (const venue of ["prologue", "simply"] as VenueKey[]) {
    roster[venue].sort((a, b) => a.startMin - b.startMin);
  }

  // Spec §4: surface Deputy's own tasks rather than building a parallel
  // system. Field support to confirm on first connect; if this account's
  // Task records turn out not to be reliably date/location-tagged, drop
  // the section back to mock/hidden rather than half-showing.
  for (const venue of ["prologue", "simply"] as VenueKey[]) {
    if (map[venue].length === 0) continue;
    try {
      const rows: any[] = await deputy("resource/Task/QUERY", {
        search: {
          due: { field: "DueDate", type: "eq", data: date },
          unit: { field: "Company", type: "in", data: map[venue] },
        },
        max: 100,
      });
      tasks[venue] = rows.map((t) => ({
        id: String(t.Id),
        title: t.Name ?? t.Title ?? "Task",
        meta: [
          t._DPMetaData?.AssigneeInfo?.DisplayName && `Assigned to ${t._DPMetaData.AssigneeInfo.DisplayName}`,
          t.DueTime ? `due ${fmtMin(tsToMin(t.DueTime))}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        done: !!t.Completed,
      }));
    } catch {
      tasks[venue] = []; // task API shape mismatch must not sink the roster
    }
  }

  const entry: DayCache = { at: Date.now(), asOf: asOfNow(), roster, tasks };
  dayCache.set(date, entry);
  return entry;
}

export async function getDeputyDay(date: string) {
  return fetchDay(date);
}

// ---------------------------------------------------------------------------
// Celebrations (spec §6) — birthdays + work anniversaries from Deputy staff
// records. Best-effort: if the account doesn't populate these dates, or the
// field names differ, this returns [] and the band simply hides. Privacy:
// only the first name + "birthday today" / "N years today" ever leave here —
// never the date of birth itself.
// ---------------------------------------------------------------------------

/** "MM-DD" for a date-ish value, or null. */
function monthDayOf(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[2]}-${iso[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const yearOf = (v: unknown): number | null => {
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
};

let employeeCache: { at: number; rows: any[] } | null = null;
const EMPLOYEE_CACHE_MS = 6 * 60 * 60 * 1000;

async function employees(): Promise<any[]> {
  if (employeeCache && Date.now() - employeeCache.at < EMPLOYEE_CACHE_MS) return employeeCache.rows;
  const rows: any[] = await deputy("resource/Employee/QUERY", {
    search: { active: { field: "Active", type: "eq", data: true } },
    max: 500,
  });
  employeeCache = { at: Date.now(), rows };
  return rows;
}

export async function getDeputyMilestones(date: string): Promise<Milestone[]> {
  const monthDay = date.slice(5); // "MM-DD" of the selected date
  const year = Number(date.slice(0, 4));
  const map = await companies();
  const companyVenue = (id: unknown): VenueKey | "both" =>
    typeof id === "number" && map.prologue.includes(id)
      ? "prologue"
      : typeof id === "number" && map.simply.includes(id)
        ? "simply"
        : "both";

  const out: Milestone[] = [];
  for (const e of await employees()) {
    const who = e.FirstName || String(e.DisplayName ?? "").split(" ")[0] || "Someone";
    const venue = companyVenue(e.Company);

    if (monthDayOf(e.DateOfBirth ?? e.Birthday) === monthDay) {
      out.push({ venue, who, what: "birthday today" });
    }
    const start = e.DateOfHire ?? e.StartDate ?? e.JoinDate ?? e.DateCommenced;
    if (monthDayOf(start) === monthDay) {
      const years = year - (yearOf(start) ?? year);
      if (years >= 1) out.push({ venue, who, what: `${years} year${years > 1 ? "s" : ""} today` });
    }
  }
  return out;
}

/** Write a completion back to Deputy and refresh the cached copy. */
export async function setDeputyTaskDone(date: string, taskId: string, done: boolean): Promise<void> {
  await deputy(`resource/Task/${taskId}`, { Completed: done });
  dayCache.delete(date);
}
