import type { VenueKey } from "@/lib/config";

// Management Dashboard sales seam. Same rules as lib/data/source.ts: the
// dashboard API only ever talks to this interface. Today the only
// implementation is the deterministic mock (lib/data/sales-mock.ts); the
// live Square + Stripe adapters slot in behind getSalesDataSource() once
// Ben provisions keys — Square per-location access token(s), and one Stripe
// restricted key PER sub-account (there are three under the main account;
// one key cannot see the others' charges). Prologue has no Stripe at all
// yet, which is a real state the interface models (`stripe: null`), not a
// mock artefact.

export type SalesPeriodKey = "day" | "week" | "month";

export const SALES_PERIODS: { key: SalesPeriodKey; label: string; compare: string }[] = [
  { key: "day", label: "Today", compare: "vs yesterday" },
  { key: "week", label: "Week to date", compare: "vs last week" },
  { key: "month", label: "Month to date", compare: "vs last month" },
];

/** One period's takings for one venue. `prev*` covers the SAME elapsed span
 *  of the prior period (month-to-date vs same days of last month), so the
 *  delta is honest mid-period. `stripe: null` = not connected, distinct
 *  from a £0 day. */
export interface SalesChannelFigures {
  square: number;
  stripe: number | null;
  prevSquare: number;
  prevStripe: number | null;
}

export interface SalesCategorySlice {
  key: string;
  label: string;
  value: number;
}

/** One point of the daily revenue trend (oldest first, ends on the report
 *  date). Combined Square + Stripe. */
export interface SalesDailyPoint {
  date: string; // YYYY-MM-DD
  total: number;
}

export interface VenueSalesReport {
  venue: VenueKey;
  stripeConnected: boolean;
  periods: Record<SalesPeriodKey, SalesChannelFigures>;
  daily: SalesDailyPoint[];
  /** Square in-store takings by category (retail/café/bar/events), per
   *  period. Square already splits by location + category, so a live
   *  adapter maps rather than tags. */
  categories: Record<SalesPeriodKey, SalesCategorySlice[]>;
}

export interface SalesDataSource {
  /** Full report for both venues as of `date` (YYYY-MM-DD, Europe/London). */
  getSales(date: string): Promise<Record<VenueKey, VenueSalesReport>>;
}
