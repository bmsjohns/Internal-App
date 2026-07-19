import type { VenueKey } from "@/lib/config";
import type { SalesDataSource } from "./sales-source";
import { LEDGER_DAYS, isoAddDays, mondayDow, reportFromLedger, type SalesDayLedger } from "./sales-shared";

// Deterministic mock sales history (fixed PRNG seed, same convention as
// clubs-mock/hub-mock) so the dashboard renders identically across dev
// restarts and tests can assert exact figures. The mock only builds the
// per-day ledger; all period/category maths lives in sales-shared.ts,
// shared with the live Square + Stripe source.

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

// Stable per-venue category mix applied to each day's Square takings (live
// Square reports real per-category figures instead).
const CATFRAC: Record<VenueKey, Record<string, number>> = {
  prologue: { retail: 0.455, cafe: 0.234, bar: 0.221, events: 0.09 },
  simply: { retail: 0.879, cafe: 0.121 },
};

function buildLedger(venue: VenueKey, asOf: string): SalesDayLedger[] {
  const p = PROFILE[venue];
  const rand = prng(p.seed);
  const days: SalesDayLedger[] = [];
  for (let i = LEDGER_DAYS - 1; i >= 0; i--) {
    const date = isoAddDays(asOf, -i);
    const weekend = mondayDow(date) >= 4; // Fri–Sun trade harder for both shops
    const progress = (LEDGER_DAYS - 1 - i) / (LEDGER_DAYS - 1);
    const lift = weekend ? p.weekendLift : 1;
    const noise = 0.82 + rand() * 0.36;
    const square = Math.round(p.base * lift * noise * (1 + p.growth * progress));
    const stripe = p.stripeConnected ? Math.round(p.stripeBase * (0.55 + rand() * 0.9)) : 0;
    const cats: Record<string, number> = {};
    for (const [key, mix] of Object.entries(CATFRAC[venue])) cats[key] = square * mix;
    days.push({ date, square, stripe, cats });
  }
  return days;
}

export const mockSalesSource: SalesDataSource = {
  async getSales(date: string) {
    return {
      prologue: reportFromLedger("prologue", buildLedger("prologue", date), PROFILE.prologue.stripeConnected),
      simply: reportFromLedger("simply", buildLedger("simply", date), PROFILE.simply.stripeConnected),
    };
  },
};
