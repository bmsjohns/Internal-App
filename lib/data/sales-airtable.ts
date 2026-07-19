import type { VenueKey } from "@/lib/config";
import { VENUES } from "@/lib/config";
import { atBase, atBaseList, requireBackstageBase } from "./backstage-base";

// "Sales Days" rollup table in the Backstage base: one row per Date × Venue,
// written by the 15-minute sync (app/api/dashboard/sync) and read by the
// live sales source. This is the durable ledger behind the trend chart and
// month-vs-month comparisons — the Square/Stripe APIs are only ever asked
// about days we haven't rolled up yet (plus today/yesterday for settles).

const TABLE = "Sales Days";

export interface SalesDayRow {
  date: string; // YYYY-MM-DD
  venue: VenueKey;
  square: number;
  stripe: number;
  cats: Record<string, number>; // retail/cafe/bar/events (GBP)
}

const CAT_FIELDS: Record<string, string> = {
  retail: "Square Retail",
  cafe: "Square Cafe",
  bar: "Square Bar",
  events: "Square Events",
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function rowOf(record: any): SalesDayRow | null {
  const f = record.fields ?? {};
  const date = String(f.Date ?? "").slice(0, 10);
  const venue = String(f.Venue ?? "") === "Prologue" ? "prologue" : String(f.Venue ?? "") === "Simply Books" ? "simply" : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !venue) return null;
  const cats: Record<string, number> = {};
  for (const [key, field] of Object.entries(CAT_FIELDS)) cats[key] = num(f[field]);
  return { date, venue, square: num(f["Square Total"]), stripe: num(f["Stripe Total"]), cats };
}

// Airtable date-field gotcha (learned the hard way on Briefing Wrap-ups):
// `{Date}='2026-07-19'` matches nothing — comparisons need DATETIME_FORMAT.
const dateEq = (iso: string) => `DATETIME_FORMAT({Date},'YYYY-MM-DD')='${iso}'`;
const dateGte = (iso: string) => `DATETIME_FORMAT({Date},'YYYY-MM-DD')>='${iso}'`;

export async function listSalesDays(fromIso: string): Promise<SalesDayRow[]> {
  const base = await requireBackstageBase("Sales rollup");
  const records = await atBaseList(base, TABLE, { filterByFormula: dateGte(fromIso) });
  return records.map(rowOf).filter((r): r is SalesDayRow => !!r);
}

export async function upsertSalesDay(row: SalesDayRow): Promise<void> {
  const base = await requireBackstageBase("Sales rollup");
  const venueLabel = VENUES[row.venue].label;
  const fields: Record<string, unknown> = {
    Date: row.date,
    Venue: venueLabel,
    "Square Total": Math.round(row.square * 100) / 100,
    "Stripe Total": Math.round(row.stripe * 100) / 100,
  };
  for (const [key, field] of Object.entries(CAT_FIELDS)) fields[field] = Math.round((row.cats[key] ?? 0) * 100) / 100;
  const existing = await atBaseList(base, TABLE, {
    filterByFormula: `AND(${dateEq(row.date)},{Venue}='${venueLabel}')`,
    maxRecords: "1",
  });
  if (existing[0]) {
    await atBase(base, `${encodeURIComponent(TABLE)}/${existing[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields, typecast: true }),
    });
  } else {
    await atBase(base, encodeURIComponent(TABLE), {
      method: "POST",
      body: JSON.stringify({ fields, typecast: true }),
    });
  }
}
