import type { SalesDataSource } from "./sales-source";
import { mockSalesSource } from "./sales-mock";

// Live wiring is a later phase (same pattern as briefing's Deputy/Slack
// overlays): a Square adapter per location and a Stripe adapter per
// sub-account key overlay the mock once their env vars exist. Until then
// every environment — including production — sees the mock sales figures,
// clearly labelled in the UI as sample data.
export function isSalesLive(): boolean {
  return false;
}

export function getSalesDataSource(): SalesDataSource {
  return mockSalesSource;
}

export type { SalesDataSource } from "./sales-source";
