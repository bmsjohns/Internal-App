import type { SalesDataSource } from "./sales-source";
import { mockSalesSource } from "./sales-mock";
import { isSalesLiveConfigured, liveSalesSource } from "./sales-live";

// Switch, same pattern as the briefing overlays: live once ANY channel's
// env vars exist (Square token and/or Stripe sales keys —
// docs/dashboard-sales-integration.md), deterministic mock otherwise. No
// blending: partially-configured live shows the unconfigured channel as
// "Not connected" rather than padding it with sample figures, and the UI's
// "Sample data" chip keys off isSalesLive().
export function isSalesLive(): boolean {
  return isSalesLiveConfigured();
}

export function getSalesDataSource(): SalesDataSource {
  return isSalesLive() ? liveSalesSource : mockSalesSource;
}

export type { SalesDataSource } from "./sales-source";
