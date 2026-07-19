import type { ReturnRequest, ReturnRequestInput, ReturnRoute, ReturnStatus } from "@/lib/types";

/**
 * Returns seam. Lifecycle (spec):
 *   requested → awaiting → approved → shipped → credit (terminal)
 * Forward moves are one step at a time with their own validated operations;
 * revert() steps back any distance, clearing later dates/picks, and every
 * transition writes the audit log (who/when — the Orders V2 pattern).
 */
export interface ReturnsDataSource {
  listReturns(): Promise<ReturnRequest[]>;
  getReturn(id: string): Promise<ReturnRequest | null>;

  /** One request per input (the builder splits by publisher client-side,
   *  mirroring how it renders — server just persists each). */
  createRequests(inputs: ReturnRequestInput[], byName: string): Promise<ReturnRequest[]>;

  /** Route choice is per-request and mandatory before submission. */
  setRoute(id: string, route: Exclude<ReturnRoute, "">, byName: string): Promise<ReturnRequest>;

  /** Discard an un-submitted request (staging only). Logged delete. */
  discard(id: string, byName: string): Promise<void>;

  /** requested → awaiting. Rejected without a route. */
  submit(id: string, byName: string): Promise<ReturnRequest>;

  /** awaiting → approved, recording the RA number (+ optional form). */
  approve(id: string, raNumber: string, raFilename: string, byName: string): Promise<ReturnRequest>;

  /** Pick-list scan: +1 picked on a line (clamped at quantity). */
  pick(id: string, lineId: string, byName: string): Promise<ReturnRequest>;

  /** approved → shipped. Rejected until every copy is picked. */
  confirmShipped(id: string, byName: string): Promise<ReturnRequest>;

  /** shipped → credit (terminal), with optional confirmed amount. */
  confirmCredit(id: string, amount: number | null, byName: string): Promise<ReturnRequest>;

  /** Move back to an earlier status; later dates, RA (if reverting below
   *  approved) and pick counts (below shipped) are cleared. */
  revert(id: string, to: ReturnStatus, byName: string): Promise<ReturnRequest>;
}
