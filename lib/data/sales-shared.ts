import type { VenueKey } from "@/lib/config";
import type {
  SalesCategorySlice,
  SalesChannelFigures,
  SalesDailyPoint,
  SalesPeriodKey,
  VenueSalesReport,
} from "./sales-source";

// Shared sales maths: both the mock and the live (Square + Stripe) sources
// reduce to the same per-day ledger, and everything the dashboard shows —
// period totals, same-elapsed-span comparators, the 28-day trend, the
// category split — derives from that ledger HERE, so the two sources can
// never disagree about how a "week to date" or a delta is computed.

/** One day of takings for one venue. `cats` holds the Square category
 *  split (unrounded — rounding happens once, at slice output). */
export interface SalesDayLedger {
  date: string; // YYYY-MM-DD
  square: number;
  stripe: number; // 0 when the venue has no Stripe
  cats: Record<string, number>;
}

export const SQUARE_CATEGORIES: { key: string; label: string }[] = [
  { key: "retail", label: "Retail (books)" },
  { key: "cafe", label: "Café" },
  { key: "bar", label: "Bar" },
  { key: "events", label: "Events" },
];

/** Days of ledger needed: month-to-date (≤31) + the full prior month (≤31). */
export const LEDGER_DAYS = 70;
export const TREND_DAYS = 28;

const dayMs = 86_400_000;

export function isoAddDays(iso: string, offset: number): string {
  return new Date(new Date(`${iso}T12:00:00Z`).getTime() + offset * dayMs).toISOString().slice(0, 10);
}

/** Monday-indexed weekday (0 = Monday … 6 = Sunday). */
export function mondayDow(iso: string): number {
  return (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** Current-period rows and the same-elapsed-span comparator rows. The
 *  ledger's LAST entry must be the report day. */
export function periodRanges(
  ledger: SalesDayLedger[],
  period: SalesPeriodKey
): { cur: SalesDayLedger[]; prev: SalesDayLedger[] } {
  const last = ledger.length - 1;
  const today = ledger[last];
  if (period === "day") return { cur: [today], prev: last >= 1 ? [ledger[last - 1]] : [] };
  if (period === "week") {
    const elapsed = mondayDow(today.date) + 1; // Monday week start
    return { cur: ledger.slice(last - elapsed + 1), prev: ledger.slice(Math.max(0, last - 7 - elapsed + 1), last - 7 + 1) };
  }
  const dayOfMonth = Number(today.date.slice(8, 10));
  const cur = ledger.slice(last - dayOfMonth + 1);
  const prevMonthEnd = last - dayOfMonth; // last day of previous month
  if (prevMonthEnd < 0) return { cur, prev: [] };
  const prevMonthDate = ledger[prevMonthEnd].date;
  const prevSpan = Math.min(dayOfMonth, Number(prevMonthDate.slice(8, 10)));
  const prevMonthStart = Math.max(0, prevMonthEnd - Number(prevMonthDate.slice(8, 10)) + 1);
  return { cur, prev: ledger.slice(prevMonthStart, prevMonthStart + prevSpan) };
}

const sum = (rows: SalesDayLedger[], k: "square" | "stripe") => rows.reduce((acc, r) => acc + r[k], 0);

function figures(ledger: SalesDayLedger[], period: SalesPeriodKey, stripeConnected: boolean): SalesChannelFigures {
  const { cur, prev } = periodRanges(ledger, period);
  return {
    square: Math.round(sum(cur, "square")),
    stripe: stripeConnected ? Math.round(sum(cur, "stripe")) : null,
    prevSquare: Math.round(sum(prev, "square")),
    prevStripe: stripeConnected ? Math.round(sum(prev, "stripe")) : null,
  };
}

function categorySlices(ledger: SalesDayLedger[], period: SalesPeriodKey): SalesCategorySlice[] {
  const { cur } = periodRanges(ledger, period);
  const totals: Record<string, number> = {};
  for (const day of cur) for (const [key, value] of Object.entries(day.cats)) totals[key] = (totals[key] ?? 0) + value;
  return SQUARE_CATEGORIES.filter((c) => (totals[c.key] ?? 0) > 0).map((c) => ({
    key: c.key,
    label: c.label,
    value: Math.round(totals[c.key]),
  }));
}

/** Ledger (oldest first, last entry = report day) → the dashboard report. */
export function reportFromLedger(venue: VenueKey, ledger: SalesDayLedger[], stripeConnected: boolean): VenueSalesReport {
  const daily: SalesDailyPoint[] = ledger
    .slice(-TREND_DAYS)
    .map((d) => ({ date: d.date, total: Math.round(d.square + d.stripe) }));
  return {
    venue,
    stripeConnected,
    periods: {
      day: figures(ledger, "day", stripeConnected),
      week: figures(ledger, "week", stripeConnected),
      month: figures(ledger, "month", stripeConnected),
    },
    daily,
    categories: {
      day: categorySlices(ledger, "day"),
      week: categorySlices(ledger, "week"),
      month: categorySlices(ledger, "month"),
    },
  };
}
