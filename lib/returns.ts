import type {
  HubPublisher,
  Location,
  ReturnRequest,
  ReturnRoute,
  ReturnStatus,
} from "@/lib/types";
import { costEach, rateFor } from "@/lib/hub";

// ---------------------------------------------------------------------------
// Returns domain logic (returns-module spec). Pure functions — shared by the
// screens, the API routes and the tests, same as lib/hub.ts.
// ---------------------------------------------------------------------------

/** Lifecycle in order. Timeline is clickable forward one step / back any
 *  number (with confirm) — the Orders V2 pattern, not a rigid stepper. */
export const RETURN_STATUSES: { key: ReturnStatus; label: string; color: string; bg: string }[] = [
  { key: "requested", label: "Requested", color: "#6E665C", bg: "#EDE8DF" },
  { key: "awaiting", label: "Awaiting approval", color: "#8A6410", bg: "#FBF1DA" },
  { key: "approved", label: "Approved", color: "#AD3B28", bg: "#FBEDEA" },
  { key: "shipped", label: "Shipped", color: "#B23A2A", bg: "#FBDCDC" },
  { key: "credit", label: "Credit confirmed", color: "#2A6B5A", bg: "#E1F0EB" },
];

export const returnStatusMeta = (s: ReturnStatus) =>
  RETURN_STATUSES.find((x) => x.key === s) ?? RETURN_STATUSES[0];

export const statusIndex = (s: ReturnStatus) => RETURN_STATUSES.findIndex((x) => x.key === s);

export const RETURN_REASONS = [
  { key: "slow-moving", label: "Slow-moving" },
  { key: "damaged", label: "Damaged" },
  { key: "overstock", label: "Overstock" },
  { key: "event-unsold", label: "Event unsold" },
];

export const RETURN_CONDITIONS = [
  { key: "new", label: "New" },
  { key: "shelf-worn", label: "Shelf-worn" },
  { key: "damaged", label: "Damaged" },
];

export const reasonLabel = (key: string) =>
  RETURN_REASONS.find((r) => r.key === key)?.label ?? key;
export const conditionLabel = (key: string) =>
  RETURN_CONDITIONS.find((c) => c.key === key)?.label ?? key;

export function routeLabel(route: ReturnRoute): string {
  if (route === "direct") return "Direct to publisher";
  if (route === "gardners") return "Via Gardners";
  return "No route yet";
}

// ---------------------------------------------------------------------------
// Waiting / overdue. "Waiting" counts from the date the CURRENT stage was
// reached — the outstanding view answers "how long have we been stuck here".
// ---------------------------------------------------------------------------

/** Awaiting an RA longer than this ⇒ chase the rep (Ben, 19 Jul 2026). */
export const AWAITING_OVERDUE_WORKING_DAYS = 3;
/** Shipped with no credit note after this ⇒ chase the credit (Ben, 19 Jul 2026). */
export const SHIPPED_OVERDUE_WORKING_DAYS = 5;

/** Working days (Mon–Fri) elapsed since a date — each weekday strictly
 *  after `iso`, up to and including today. Publisher offices don't move
 *  on weekends, so chase thresholds count these, not calendar days. */
export function workingDaysSince(iso: string | null, now = Date.now()): number {
  if (!iso) return 0;
  const end = new Date(now).toISOString().slice(0, 10);
  const cur = new Date(iso + "T12:00:00");
  let count = 0;
  for (;;) {
    cur.setDate(cur.getDate() + 1);
    if (cur.toISOString().slice(0, 10) > end) break;
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

export function statusDate(r: ReturnRequest): string | null {
  switch (r.status) {
    case "requested":
      return r.dateRequested;
    case "awaiting":
      return r.dateSubmitted;
    case "approved":
      return r.dateApproved;
    case "shipped":
      return r.dateShipped;
    case "credit":
      return r.dateCreditConfirmed;
  }
}

export function waitingDays(r: ReturnRequest, now = Date.now()): number {
  if (r.status === "credit") return 0;
  const since = statusDate(r) ?? r.dateRequested;
  if (!since) return 0;
  return Math.max(0, Math.floor((now - new Date(since + "T12:00:00").getTime()) / 864e5));
}

export function isReturnOverdue(r: ReturnRequest, now = Date.now()): boolean {
  if (r.status === "awaiting")
    return workingDaysSince(r.dateSubmitted ?? r.dateRequested, now) > AWAITING_OVERDUE_WORKING_DAYS;
  if (r.status === "shipped") return workingDaysSince(r.dateShipped, now) > SHIPPED_OVERDUE_WORKING_DAYS;
  return false;
}

// ---------------------------------------------------------------------------
// Money. Estimated credit = what we paid, i.e. RRP less the publisher's
// restock (base) discount — reusing the Hub's rate machinery (spec: shared
// mechanics, publisher data reused not reinvented).
// ---------------------------------------------------------------------------

export function estimatedCredit(r: ReturnRequest, pub: HubPublisher | null | undefined): number {
  return r.lines.reduce((sum, l) => {
    const each = costEach(l.rrp, rateFor(pub, "restock", r.location));
    return sum + (each == null ? 0 : each * l.quantity);
  }, 0);
}

export const returnUnits = (r: ReturnRequest) => r.lines.reduce((s, l) => s + l.quantity, 0);
export const pickedUnits = (r: ReturnRequest) => r.lines.reduce((s, l) => s + l.picked, 0);
export const pickComplete = (r: ReturnRequest) =>
  r.lines.length > 0 && r.lines.every((l) => l.picked >= l.quantity);

// ---------------------------------------------------------------------------
// Staging groups: publisher × location, mirroring the Hub's publisher ×
// account batching — Simply Books and Prologue returns never combine, and
// requests to the same rep can share one RA.
// ---------------------------------------------------------------------------

export interface StagingGroup {
  key: string; // `${publisherId}|${location}`
  publisherId: string | null;
  location: Location;
  requests: ReturnRequest[];
}

export function groupStaging(requests: ReturnRequest[]): StagingGroup[] {
  const byKey = new Map<string, ReturnRequest[]>();
  for (const r of requests) {
    if (r.status !== "requested") continue;
    const key = `${r.publisherId ?? "unknown"}|${r.location}`;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }
  return [...byKey.entries()].map(([key, rs]) => ({
    key,
    publisherId: rs[0].publisherId,
    location: rs[0].location,
    requests: rs,
  }));
}

/** The account number a return goes out under — the Hub publisher's number
 *  for the return's own location (two accounts per publisher, C6). */
export function returnAccountNumber(r: ReturnRequest, pub: HubPublisher | null | undefined): string {
  return pub?.accountNumbers[r.location] ?? "";
}

// ---------------------------------------------------------------------------
// Pick-list scanning: scanning a known ISBN confirms the next unpicked copy
// of that title; an empty scan (camera simulate / bare Enter) picks the next
// outstanding copy of anything.
// ---------------------------------------------------------------------------

export type PickScanResult =
  | { ok: true; lineId: string; title: string }
  | { ok: false; reason: "not-on-list" | "already-picked" | "all-picked" };

export function matchPickScan(r: ReturnRequest, scanned: string): PickScanResult {
  const isbn = scanned.replace(/[^0-9Xx]/g, "");
  if (!isbn) {
    const next = r.lines.find((l) => l.picked < l.quantity);
    return next ? { ok: true, lineId: next.id, title: next.title } : { ok: false, reason: "all-picked" };
  }
  const open = r.lines.find((l) => l.isbn === isbn && l.picked < l.quantity);
  if (open) return { ok: true, lineId: open.id, title: open.title };
  return r.lines.some((l) => l.isbn === isbn)
    ? { ok: false, reason: "already-picked" }
    : { ok: false, reason: "not-on-list" };
}

// ---------------------------------------------------------------------------
// Outstanding view CSV (same escaping rules as the Hub's batchCsv).
// ---------------------------------------------------------------------------

export function outstandingCsv(rows: ReturnRequest[], publishers: HubPublisher[], now = Date.now()): string {
  const cell = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = "Return,Location,Publisher,Route,Origin,Status,Waiting (days),Titles,Units,RA number,Est. credit";
  const body = rows.map((r) => {
    const pub = publishers.find((p) => p.id === r.publisherId);
    return [
      cell(r.code),
      cell(r.location),
      cell(pub?.name ?? ""),
      cell(routeLabel(r.route)),
      r.origin === "event" ? "Event" : "General stock",
      cell(returnStatusMeta(r.status).label),
      waitingDays(r, now),
      r.lines.length,
      returnUnits(r),
      cell(r.raNumber),
      estimatedCredit(r, pub).toFixed(2),
    ].join(",");
  });
  return [head, ...body].join("\n");
}
