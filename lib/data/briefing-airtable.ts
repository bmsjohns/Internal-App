import type { VenueKey } from "@/lib/config";
import type { UrgentAlert, WrapDraft, WrapUp } from "@/lib/briefing";

// Airtable persistence for the briefing's wrap-ups and urgent alerts — the
// two things that must outlive a serverless invocation. Lives in the
// general-purpose "Backstage" base (NOT the Customer Orders or Events
// bases), which future features can add their own tables to.
//
// The base is found BY NAME through the Airtable meta API, so adding a new
// base never means adding a new Vercel env var (Ben's rule). Requirements
// on the app's AIRTABLE_API_KEY token: the Backstage base in its access
// list, and the `schema.bases:read` scope (for the by-name lookup).
// BACKSTAGE_AIRTABLE_BASE_ID remains as an optional override/escape hatch.
//
// Expected schema (field names are load-bearing):
//   "Briefing Wrap-ups": Date (date, ISO) · Venue (single select:
//     Prologue / Simply Books) · Headline · Body (long text) · Byline ·
//     Posted At
//   "Briefing Alerts": Text (primary) · Date (date, ISO) · Location
//     (single select: Both / Prologue / Simply Books) · Dismissed (checkbox)

const BASE_NAME = "backstage";
const WRAPS_TABLE = "Briefing Wrap-ups";
const ALERTS_TABLE = "Briefing Alerts";

export const briefingAirtableConfigured = () => !!process.env.AIRTABLE_API_KEY;

/** Pure matcher, exported for tests: exact case-insensitive name match. */
export const pickBackstageBase = (bases: { id: string; name: string }[]): string | null =>
  bases.find((b) => b.name.trim().toLowerCase() === BASE_NAME)?.id ?? null;

// Resolution cache — negative results too, so a missing base or a token
// without meta scope costs one lookup per 10 minutes, not one per pageview.
let baseCache: { id: string | null; at: number } | null = null;
const BASE_CACHE_MS = 10 * 60 * 1000;

const authHeaders = () => ({
  Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
  "Content-Type": "application/json",
});

async function resolveBaseId(): Promise<string | null> {
  if (process.env.BACKSTAGE_AIRTABLE_BASE_ID) return process.env.BACKSTAGE_AIRTABLE_BASE_ID;
  if (baseCache && Date.now() - baseCache.at < BASE_CACHE_MS) return baseCache.id;
  let id: string | null = null;
  try {
    const bases: { id: string; name: string }[] = [];
    let offset: string | undefined;
    do {
      const res = await fetch(
        `https://api.airtable.com/v0/meta/bases${offset ? `?offset=${offset}` : ""}`,
        { headers: authHeaders(), cache: "no-store" }
      );
      if (!res.ok) throw new Error(`meta/bases ${res.status}`);
      const data = await res.json();
      bases.push(...(data.bases ?? []));
      offset = data.offset;
    } while (offset);
    id = pickBackstageBase(bases);
    if (!id) console.error(`Briefing: no Airtable base named "Backstage" visible to this token`);
  } catch (e) {
    console.error("Briefing: Backstage base lookup failed (token may lack schema.bases:read)", e);
  }
  baseCache = { id, at: Date.now() };
  return id;
}

/** True once the Backstage base is actually reachable. */
export async function briefingAirtableReady(): Promise<boolean> {
  return briefingAirtableConfigured() && (await resolveBaseId()) !== null;
}

const VENUE_NAME: Record<VenueKey, string> = { prologue: "Prologue", simply: "Simply Books" };
const LOC_NAME: Record<UrgentAlert["loc"], string> = { ...VENUE_NAME, both: "Both" };

async function at(path: string, init?: RequestInit): Promise<any> {
  const baseId = await resolveBaseId();
  if (!baseId) throw new Error("Backstage Airtable base not reachable");
  const res = await fetch(`https://api.airtable.com/v0/${baseId}/${path}`, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Airtable (Backstage base) ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Shared Backstage-base request for sibling modules (e.g. opening hours),
 *  so base-name resolution and auth live in one place. */
export const backstageApi = (path: string, init?: RequestInit) => at(path, init);

// Airtable gotcha: a date field compared to a string with `=` (e.g.
// `{Date}='2026-07-18'`) matches NOTHING — {Date} evaluates to a datetime,
// so the equality is always false and every read comes back empty even
// though the write succeeded. Compare the formatted date instead.
export const dateEq = (date: string) => `DATETIME_FORMAT({Date},'YYYY-MM-DD')='${date}'`;

const byDate = (table: string, date: string, extra = "") =>
  `${encodeURIComponent(table)}?filterByFormula=${encodeURIComponent(
    extra ? `AND(${dateEq(date)},${extra})` : dateEq(date)
  )}`;

const rowToWrap = (fields: any): WrapDraft => ({
  headline: fields.Headline ?? "",
  body: fields.Body ?? "",
  byline: fields.Byline ?? "",
  postedAt: fields["Posted At"] ?? "",
  draft: !!fields.Draft,
});

/** PUBLISHED wraps covering `date` (shown on the following day's briefing —
 *  drafts are excluded so an unfinished note never surfaces). */
export async function getAirtableWraps(date: string): Promise<Partial<Record<VenueKey, WrapUp>>> {
  const data = await at(byDate(WRAPS_TABLE, date, "NOT({Draft})"));
  const out: Partial<Record<VenueKey, WrapUp>> = {};
  for (const r of data.records ?? []) {
    const venue = (Object.keys(VENUE_NAME) as VenueKey[]).find((k) => VENUE_NAME[k] === r.fields.Venue);
    if (venue) out[venue] = rowToWrap(r.fields);
  }
  return out;
}

/** This day's OWN wraps incl. drafts — drives the same-day editor state. */
export async function getAirtableWrapsForDay(date: string): Promise<Partial<Record<VenueKey, WrapDraft>>> {
  const data = await at(byDate(WRAPS_TABLE, date));
  const out: Partial<Record<VenueKey, WrapDraft>> = {};
  for (const r of data.records ?? []) {
    const venue = (Object.keys(VENUE_NAME) as VenueKey[]).find((k) => VENUE_NAME[k] === r.fields.Venue);
    if (venue) out[venue] = rowToWrap(r.fields);
  }
  return out;
}

/** Upsert — one wrap per date × venue, edits overwrite. */
export async function saveAirtableWrap(
  date: string,
  venue: VenueKey,
  wrap: WrapUp,
  draft: boolean
): Promise<void> {
  const fields = {
    Date: date,
    Venue: VENUE_NAME[venue],
    Headline: wrap.headline,
    Body: wrap.body,
    Byline: wrap.byline,
    "Posted At": wrap.postedAt,
    Draft: draft,
  };
  const existing = await at(byDate(WRAPS_TABLE, date, `{Venue}='${VENUE_NAME[venue]}'`));
  const id = existing.records?.[0]?.id;
  if (id) {
    await at(`${encodeURIComponent(WRAPS_TABLE)}/${id}`, { method: "PATCH", body: JSON.stringify({ fields }) });
  } else {
    await at(encodeURIComponent(WRAPS_TABLE), {
      method: "POST",
      body: JSON.stringify({ records: [{ fields }], typecast: true }),
    });
  }
}

export async function getAirtableAlerts(date: string): Promise<UrgentAlert[]> {
  const data = await at(byDate(ALERTS_TABLE, date, "NOT({Dismissed})"));
  return (data.records ?? []).map((r: any) => ({
    id: r.id,
    text: r.fields.Text ?? "",
    loc:
      ((Object.keys(LOC_NAME) as UrgentAlert["loc"][]).find((k) => LOC_NAME[k] === r.fields.Location) ??
        "both") as UrgentAlert["loc"],
  }));
}

export async function postAirtableAlert(
  date: string,
  text: string,
  loc: UrgentAlert["loc"]
): Promise<UrgentAlert> {
  const data = await at(encodeURIComponent(ALERTS_TABLE), {
    method: "POST",
    body: JSON.stringify({
      records: [{ fields: { Text: text, Date: date, Location: LOC_NAME[loc] } }],
      typecast: true,
    }),
  });
  return { id: data.records[0].id, text, loc };
}

/** Dismiss = flag, not delete — keeps an audit trail in the base. */
export async function dismissAirtableAlert(alertId: string): Promise<void> {
  await at(`${encodeURIComponent(ALERTS_TABLE)}/${alertId}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: { Dismissed: true } }),
  });
}
