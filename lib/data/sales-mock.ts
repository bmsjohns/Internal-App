import type { VenueKey } from "@/lib/config";
import type {
  SalesCategorySlice,
  SalesChannelFigures,
  SalesDataSource,
  SalesDailyPoint,
  SalesPeriodKey,
  VenueSalesReport,
} from "./sales-source";

// Deterministic mock sales history (fixed PRNG seed, same convention as
// clubs-mock/hub-mock) so the dashboard renders identically across dev
// restarts and tests can assert exact figures. Everything derives from one
// simulated per-day, per-channel ledger, so period totals, deltas, the
// trend chart and the category split can never disagree with each other.

// mulberry32 — tiny deterministic PRNG.
function prng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DayLedger {
  date: string; // YYYY-MM-DD
  square: number;
  stripe: number; // 0 when the venue has no Stripe
}

const PROFILE: Record<
  VenueKey,
  { seed: number; base: number; weekendLift: number; growth: number; stripeBase: number; stripeConnected: boolean }
> = {
  // Prologue: bigger site (bar + events), stronger weekends, no Stripe yet.
  prologue: { seed: 20260701, base: 2050, weekendLift: 1.55, growth: 0.22, stripeBase: 0, stripeConnected: false },
  // Simply Books: steadier retail day, Stripe = book-club subscriptions
  // (arrives in per-member dribs across the month).
  simply: { seed: 20260702, base: 1150, weekendLift: 1.35, growth: 0.14, stripeBase: 265, stripeConnected: true },
};

// Square category mix. Live Square splits this per location already; the
// mock applies a stable per-venue fraction to the day's takings.
const CATEGORIES: { key: string; label: string; mix: Record<VenueKey, number> }[] = [
  { key: "retail", label: "Retail (books)", mix: { prologue: 0.455, simply: 0.879 } },
  { key: "cafe", label: "Café", mix: { prologue: 0.234, simply: 0.121 } },
  { key: "bar", label: "Bar", mix: { prologue: 0.221, simply: 0 } },
  { key: "events", label: "Events", mix: { prologue: 0.09, simply: 0 } },
];

const HISTORY_DAYS = 70; // covers month-to-date + the full prior month span
const TREND_DAYS = 28;

const dayMs = 86_400_000;

function isoAt(anchor: Date, offset: number): string {
  return new Date(anchor.getTime() + offset * dayMs).toISOString().slice(0, 10);
}

/** Monday-indexed weekday (0 = Monday … 6 = Sunday). */
function dow(iso: string): number {
  return (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
}

function buildLedger(venue: VenueKey, asOf: string): DayLedger[] {
  const p = PROFILE[venue];
  const rand = prng(p.seed);
  const anchor = new Date(`${asOf}T12:00:00Z`);
  const days: DayLedger[] = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const date = isoAt(anchor, -i);
    const weekday = dow(date);
    const weekend = weekday >= 4; // Fri–Sun trade harder for both shops
    const progress = (HISTORY_DAYS - 1 - i) / (HISTORY_DAYS - 1);
    const lift = weekend ? p.weekendLift : 1;
    const noise = 0.82 + rand() * 0.36;
    const square = Math.round(p.base * lift * noise * (1 + p.growth * progress));
    const stripe = p.stripeConnected ? Math.round(p.stripeBase * (0.55 + rand() * 0.9)) : 0;
    days.push({ date, square, stripe });
  }
  return days;
}

/** [start, end] inclusive index ranges into the ledger for a period and its
 *  same-elapsed-span comparator. The ledger's last entry is the report day. */
function periodRanges(ledger: DayLedger[], period: SalesPeriodKey): { cur: DayLedger[]; prev: DayLedger[] } {
  const last = ledger.length - 1;
  const today = ledger[last];
  if (period === "day") return { cur: [today], prev: [ledger[last - 1]] };
  if (period === "week") {
    const elapsed = dow(today.date) + 1; // Monday week start
    return { cur: ledger.slice(last - elapsed + 1), prev: ledger.slice(last - 7 - elapsed + 1, last - 7 + 1) };
  }
  const dayOfMonth = Number(today.date.slice(8, 10));
  const cur = ledger.slice(last - dayOfMonth + 1);
  const prevMonthEnd = last - dayOfMonth; // last day of previous month
  const prevMonthDate = ledger[prevMonthEnd].date;
  const prevSpan = Math.min(dayOfMonth, Number(prevMonthDate.slice(8, 10)));
  const prevMonthStart = prevMonthEnd - Number(prevMonthDate.slice(8, 10)) + 1;
  return { cur, prev: ledger.slice(prevMonthStart, prevMonthStart + prevSpan) };
}

const sum = (rows: DayLedger[], k: "square" | "stripe") => rows.reduce((acc, r) => acc + r[k], 0);

function figures(ledger: DayLedger[], period: SalesPeriodKey, stripeConnected: boolean): SalesChannelFigures {
  const { cur, prev } = periodRanges(ledger, period);
  return {
    square: sum(cur, "square"),
    stripe: stripeConnected ? sum(cur, "stripe") : null,
    prevSquare: sum(prev, "square"),
    prevStripe: stripeConnected ? sum(prev, "stripe") : null,
  };
}

function categorySlices(ledger: DayLedger[], venue: VenueKey, period: SalesPeriodKey): SalesCategorySlice[] {
  const { cur } = periodRanges(ledger, period);
  const squareTotal = sum(cur, "square");
  return CATEGORIES.filter((c) => c.mix[venue] > 0).map((c) => ({
    key: c.key,
    label: c.label,
    value: Math.round(squareTotal * c.mix[venue]),
  }));
}

function buildReport(venue: VenueKey, asOf: string): VenueSalesReport {
  const ledger = buildLedger(venue, asOf);
  const stripeConnected = PROFILE[venue].stripeConnected;
  const daily: SalesDailyPoint[] = ledger
    .slice(-TREND_DAYS)
    .map((d) => ({ date: d.date, total: d.square + d.stripe }));
  const period = (key: SalesPeriodKey) => figures(ledger, key, stripeConnected);
  return {
    venue,
    stripeConnected,
    periods: { day: period("day"), week: period("week"), month: period("month") },
    daily,
    categories: {
      day: categorySlices(ledger, venue, "day"),
      week: categorySlices(ledger, venue, "week"),
      month: categorySlices(ledger, venue, "month"),
    },
  };
}

export const mockSalesSource: SalesDataSource = {
  async getSales(date: string) {
    return {
      prologue: buildReport("prologue", date),
      simply: buildReport("simply", date),
    };
  },
};
