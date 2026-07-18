import type { VenueKey } from "@/lib/config";
import type { UrgentAlert, WrapUp } from "@/lib/briefing";

// Airtable persistence for the briefing's wrap-ups and urgent alerts — the
// two things that must outlive a serverless invocation. Lives in the
// general-purpose "Backstage" base (NOT the Customer Orders or Events
// bases), which future features can add their own tables to.
//
// Expected schema (created via the Airtable integration; field names are
// load-bearing):
//   "Briefing Wrap-ups": Date (date, ISO) · Venue (single select:
//     Prologue / Simply Books) · Headline · Body (long text) · Byline ·
//     Posted At
//   "Briefing Alerts": Text (primary) · Date (date, ISO) · Location
//     (single select: Both / Prologue / Simply Books) · Dismissed (checkbox)
//
// Off until BACKSTAGE_AIRTABLE_BASE_ID is set (plus the shared
// AIRTABLE_API_KEY, which must have this base in its scope). Until then the
// in-memory mock store handles both — fine for dev, ephemeral in prod.

const WRAPS_TABLE = "Briefing Wrap-ups";
const ALERTS_TABLE = "Briefing Alerts";

export const briefingAirtableConfigured = () =>
  !!(process.env.AIRTABLE_API_KEY && process.env.BACKSTAGE_AIRTABLE_BASE_ID);

const VENUE_NAME: Record<VenueKey, string> = { prologue: "Prologue", simply: "Simply Books" };
const LOC_NAME: Record<UrgentAlert["loc"], string> = { ...VENUE_NAME, both: "Both" };

async function at(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(
    `https://api.airtable.com/v0/${process.env.BACKSTAGE_AIRTABLE_BASE_ID}/${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`Airtable (Backstage base) ${res.status}: ${await res.text()}`);
  return res.json();
}

const byDate = (table: string, date: string, extra = "") =>
  `${encodeURIComponent(table)}?filterByFormula=${encodeURIComponent(
    extra ? `AND({Date}='${date}',${extra})` : `{Date}='${date}'`
  )}`;

/** Wrap-ups COVERING `date` (the page shows them on the following day). */
export async function getAirtableWraps(date: string): Promise<Partial<Record<VenueKey, WrapUp>>> {
  const data = await at(byDate(WRAPS_TABLE, date));
  const out: Partial<Record<VenueKey, WrapUp>> = {};
  for (const r of data.records ?? []) {
    const venue = (Object.keys(VENUE_NAME) as VenueKey[]).find((k) => VENUE_NAME[k] === r.fields.Venue);
    if (!venue) continue;
    out[venue] = {
      headline: r.fields.Headline ?? "",
      body: r.fields.Body ?? "",
      byline: r.fields.Byline ?? "",
      postedAt: r.fields["Posted At"] ?? "",
    };
  }
  return out;
}

/** Upsert — one wrap per date × venue, edits overwrite. */
export async function saveAirtableWrap(date: string, venue: VenueKey, wrap: WrapUp): Promise<void> {
  const fields = {
    Date: date,
    Venue: VENUE_NAME[venue],
    Headline: wrap.headline,
    Body: wrap.body,
    Byline: wrap.byline,
    "Posted At": wrap.postedAt,
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
