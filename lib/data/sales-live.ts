import type { VenueKey } from "@/lib/config";
import { todayLondon } from "@/lib/briefing";
import type { SalesDataSource, VenueSalesReport } from "./sales-source";
import { LEDGER_DAYS, isoAddDays, reportFromLedger, type SalesDayLedger } from "./sales-shared";
import { listSalesDays, upsertSalesDay, type SalesDayRow } from "./sales-airtable";
import { fetchSquareDay, squareConfigured } from "./sales-square";
import { fetchStripeDay, stripeSalesConfigured, stripeSalesKeys } from "./sales-stripe";

// Live sales source: Square + Stripe → "Sales Days" rollup rows → the same
// shared ledger maths as the mock. Freshness contract (Ben, 19 Jul 2026):
// figures are never more than ~15 minutes stale. Two mechanisms deliver it:
//   · the Vercel cron hits /api/dashboard/sync every 15 minutes, and
//   · getSales() self-heals — if the last sync is older than the TTL (cron
//     missing, Hobby plan, local dev) it syncs today+yesterday inline first.
// Only today/yesterday are re-fetched from the APIs on a normal sync
// (yesterday catches late-settling card payments); older days come from the
// rollup table, backfilled up to BACKFILL_PER_RUN days per run until the
// 70-day window is complete.

const SYNC_TTL_MS = 15 * 60 * 1000;
const READ_CACHE_MS = 3 * 60 * 1000; // spare Airtable (5 rps) on quick venue toggles
const BACKFILL_PER_RUN = 30;

const VENUES_ALL: VenueKey[] = ["prologue", "simply"];

declare global {
  // eslint-disable-next-line no-var
  var __backstageSalesSync: { lastSyncAt: number } | undefined;
  // eslint-disable-next-line no-var
  var __backstageSalesRead: { at: number; date: string; reports: Record<VenueKey, VenueSalesReport> } | undefined;
}

export function isSalesLiveConfigured(): boolean {
  return squareConfigured() || stripeSalesConfigured();
}

export interface SalesSyncResult {
  ran: boolean;
  updated: string[]; // "venue date" labels actually written
  errors: string[];
}

/** Fetch + upsert one venue-day. Keeps whichever channel isn't configured
 *  (or fails location discovery) from zeroing data an earlier sync wrote. */
async function syncVenueDay(venue: VenueKey, date: string, existing: SalesDayRow | undefined): Promise<boolean> {
  const [square, stripe] = await Promise.all([
    squareConfigured() ? fetchSquareDay(venue, date) : Promise.resolve(null),
    fetchStripeDay(venue, date),
  ]);
  if (square == null && stripe == null) return false; // nothing configured for this venue
  await upsertSalesDay({
    date,
    venue,
    square: square?.total ?? existing?.square ?? 0,
    cats: square?.cats ?? existing?.cats ?? {},
    stripe: stripe ?? existing?.stripe ?? 0,
  });
  return true;
}

export async function runSalesSync(now = todayLondon()): Promise<SalesSyncResult> {
  if (!isSalesLiveConfigured()) return { ran: false, updated: [], errors: [] };
  const result: SalesSyncResult = { ran: true, updated: [], errors: [] };
  const windowStart = isoAddDays(now, -(LEDGER_DAYS - 1));
  let existing: SalesDayRow[] = [];
  try {
    existing = await listSalesDays(windowStart);
  } catch (e) {
    result.errors.push(`rollup read: ${e instanceof Error ? e.message : String(e)}`);
    globalThis.__backstageSalesSync = { lastSyncAt: Date.now() }; // don't hammer a broken base every load
    return result;
  }
  const byKey = new Map(existing.map((r) => [`${r.venue} ${r.date}`, r] as const));

  // Always today + yesterday; then newest-first backfill of missing days.
  const wanted: string[] = [now, isoAddDays(now, -1)];
  for (let i = 2; i < LEDGER_DAYS && wanted.length < 2 + BACKFILL_PER_RUN; i++) {
    const date = isoAddDays(now, -i);
    if (VENUES_ALL.some((v) => !byKey.has(`${v} ${date}`))) wanted.push(date);
  }

  for (const date of wanted) {
    for (const venue of VENUES_ALL) {
      const isCatchup = date !== now && date !== isoAddDays(now, -1);
      if (isCatchup && byKey.has(`${venue} ${date}`)) continue;
      try {
        if (await syncVenueDay(venue, date, byKey.get(`${venue} ${date}`))) result.updated.push(`${venue} ${date}`);
      } catch (e) {
        result.errors.push(`${venue} ${date}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  globalThis.__backstageSalesSync = { lastSyncAt: Date.now() };
  globalThis.__backstageSalesRead = undefined; // next read sees fresh rows
  return result;
}

function ledgerFor(venue: VenueKey, rows: SalesDayRow[], asOf: string): SalesDayLedger[] {
  const byDate = new Map(rows.filter((r) => r.venue === venue).map((r) => [r.date, r] as const));
  const days: SalesDayLedger[] = [];
  for (let i = LEDGER_DAYS - 1; i >= 0; i--) {
    const date = isoAddDays(asOf, -i);
    const row = byDate.get(date);
    days.push({ date, square: row?.square ?? 0, stripe: row?.stripe ?? 0, cats: row?.cats ?? {} });
  }
  return days;
}

export const liveSalesSource: SalesDataSource = {
  async getSales(date: string) {
    const read = globalThis.__backstageSalesRead;
    if (read && read.date === date && Date.now() - read.at < READ_CACHE_MS) return read.reports;

    const lastSyncAt = globalThis.__backstageSalesSync?.lastSyncAt ?? 0;
    if (Date.now() - lastSyncAt > SYNC_TTL_MS) {
      // Inline self-heal; failures fall through to whatever the table holds.
      const sync = await runSalesSync(date).catch((e) => ({ ran: true, updated: [], errors: [String(e)] }));
      for (const err of sync.errors) console.error("sales sync:", err);
    }

    const rows = await listSalesDays(isoAddDays(date, -(LEDGER_DAYS - 1)));
    const reports = {
      prologue: reportFromLedger("prologue", ledgerFor("prologue", rows, date), stripeSalesKeys("prologue").length > 0),
      simply: reportFromLedger("simply", ledgerFor("simply", rows, date), stripeSalesKeys("simply").length > 0),
    };
    globalThis.__backstageSalesRead = { at: Date.now(), date, reports };
    return reports;
  },
};
