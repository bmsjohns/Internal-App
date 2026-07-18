import type { VenueKey } from "@/lib/config";
import type { BriefTask, ShiftEntry } from "@/lib/briefing";
import { fmtMin } from "@/lib/briefing";

// Deputy adapter for the briefing's On Shift + Notes/Tasks sections
// (spec §2/§4). Needs a permanent service-account token — a setup step for
// Ben, not something the app can provision (spec §2). Until the env vars
// below are set, deputyConfigured() is false and the mock supplies data.
//
// ⚠️ UNVERIFIED AGAINST A LIVE ACCOUNT: written to Deputy's documented
// Resource API (POST /api/v1/resource/<Resource>/QUERY), but the exact
// field names in this account (spec §9) must be confirmed on first connect.
//
//   DEPUTY_HOSTNAME          e.g. "simplybooks.eu.deputy.com"
//   DEPUTY_API_TOKEN         permanent token (Deputy docs: "permanent token")
//   DEPUTY_OPUNIT_PROLOGUE   OperationalUnit/Company ids, comma-separated
//   DEPUTY_OPUNIT_SIMPLY     — the Deputy→venue mapping from spec §2.

export const deputyConfigured = () =>
  !!(
    process.env.DEPUTY_HOSTNAME &&
    process.env.DEPUTY_API_TOKEN &&
    process.env.DEPUTY_OPUNIT_PROLOGUE &&
    process.env.DEPUTY_OPUNIT_SIMPLY
  );

const opUnits = (venue: VenueKey): string[] =>
  (venue === "prologue" ? process.env.DEPUTY_OPUNIT_PROLOGUE : process.env.DEPUTY_OPUNIT_SIMPLY)!
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

async function deputy(path: string, body?: unknown): Promise<any> {
  const res = await fetch(`https://${process.env.DEPUTY_HOSTNAME}/api/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEPUTY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Deputy ${res.status}: ${await res.text()}`);
  return res.json();
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
const cache = new Map<string, DayCache>();

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
  const hit = cache.get(date);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;

  const roster = { prologue: [], simply: [] } as Record<VenueKey, ShiftEntry[]>;
  const tasks = { prologue: [], simply: [] } as Record<VenueKey, BriefTask[]>;

  for (const venue of ["prologue", "simply"] as VenueKey[]) {
    const units = opUnits(venue);
    // Roster records for the date + this venue's operational units, with the
    // employee joined in for the display name (spec §2).
    const rows: any[] = await deputy("resource/Roster/QUERY", {
      search: {
        date: { field: "Date", type: "eq", data: date },
        unit: { field: "OperationalUnit", type: "in", data: units },
      },
      join: ["EmployeeObject", "OperationalUnitObject"],
      max: 100,
    });
    roster[venue] = rows
      .filter((r) => !r.Open) // open (unassigned) shifts aren't "who's on"
      .map((r) => ({
        id: String(r.Id),
        name: r.EmployeeObject?.DisplayName ?? r._DPMetaData?.EmployeeInfo?.DisplayName ?? "Unassigned",
        role: r.OperationalUnitObject?.OperationalUnitName ?? "",
        startMin: tsToMin(r.StartTime),
        endMin: tsToMin(r.EndTime),
      }))
      .sort((a, b) => a.startMin - b.startMin);

    // Spec §4: surface Deputy's own tasks rather than building a parallel
    // system. Field support to confirm on first connect; if this account's
    // Task records turn out not to be reliably date/location-tagged, drop
    // the section back to mock/hidden rather than half-showing.
    try {
      const rows: any[] = await deputy("resource/Task/QUERY", {
        search: {
          due: { field: "DueDate", type: "eq", data: date },
          unit: { field: "Company", type: "in", data: units },
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
  cache.set(date, entry);
  return entry;
}

export async function getDeputyDay(date: string) {
  return fetchDay(date);
}

/** Write a completion back to Deputy and refresh the cached copy. */
export async function setDeputyTaskDone(date: string, taskId: string, done: boolean): Promise<void> {
  await deputy(`resource/Task/${taskId}`, { Completed: done });
  cache.delete(date);
}
