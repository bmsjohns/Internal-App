import type {
  HubLine,
  HubLineState,
  HubOrderType,
  HubPublisher,
  HubSource,
  Location,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Ordering Hub domain logic (spec Part C). Pure functions — shared by the
// screens, the API routes and the tests.
// ---------------------------------------------------------------------------

/** Source badge colours (design: srcMap). */
export const HUB_SOURCES: Record<HubSource, { label: string; color: string; bg: string }> = {
  bookclub: { label: "Book Club", color: "#6A4E9C", bg: "#EEE8F6" },
  events: { label: "Event", color: "#2F6690", bg: "#E1ECF3" },
  schools: { label: "School", color: "#B0812F", bg: "#FBF1DA" },
  customer: { label: "Customer", color: "#2E6B4F", bg: "#E1EFE7" },
};

/** Lifecycle pill colours (design: orderStateTag). */
export const HUB_STATES: Record<HubLineState, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "#8C857C", bg: "#EDEAE3" },
  pending: { label: "Pending", color: "#B0812F", bg: "#FBF1DA" },
  ordered: { label: "Ordered", color: "#2F6690", bg: "#E1ECF3" },
  arrived: { label: "Arrived", color: "#2E6B4F", bg: "#E1EFE7" },
};

export const ORDER_TYPES: { key: HubOrderType; label: string }[] = [
  { key: "restock", label: "Restock" },
  { key: "bookclub", label: "Book Club" },
  { key: "events", label: "Events" },
  { key: "schools", label: "Schools" },
];

/** Drafts sitting unpushed longer than this get flagged in the Hub and on
 *  the Daily Briefing (C2). Default 7 days — Ben to confirm (spec D). */
export const STALE_DRAFT_DAYS = 7;

export function draftAgeDays(createdAt: string, now = Date.now()): number {
  return Math.floor((now - new Date(createdAt).getTime()) / 864e5);
}

export function isStaleDraft(line: HubLine, now = Date.now()): boolean {
  return line.state === "draft" && draftAgeDays(line.createdAt, now) >= STALE_DRAFT_DAYS;
}

// ---------------------------------------------------------------------------
// Discounts (C6): straight % off RRP, Publisher × Order Type, both axes
// required. Restock is the base — any type without its own rate falls back
// to it. Per-account override is the rare exception; imprints never differ.
// ---------------------------------------------------------------------------

export function rateFor(
  pub: HubPublisher | null | undefined,
  orderType: HubOrderType,
  account: Location | null
): number | null {
  if (!pub) return null;
  const override = account ? pub.accountOverrides[account]?.[orderType] : undefined;
  if (override != null) return override;
  return pub.rates[orderType] ?? pub.rates.restock;
}

/** True when the effective rate differs from the base Publisher × Type rate
 *  (i.e. a per-account override applies) — visually flagged (C6). */
export function isOverridden(pub: HubPublisher, orderType: HubOrderType, account: Location): boolean {
  return pub.accountOverrides[account]?.[orderType] != null;
}

/** Cost each after discount; null when RRP or rate is unknown. */
export function costEach(rrp: number | null, rate: number | null): number | null {
  if (rrp == null || rate == null) return null;
  return rrp * (1 - rate / 100);
}

export function lineCost(line: HubLine, pub: HubPublisher | null | undefined): number | null {
  const each = costEach(line.rrp, rateFor(pub, line.orderType, line.account));
  return each == null ? null : each * line.quantity;
}

// ---------------------------------------------------------------------------
// Imprints — stored in the live Publishers table as comma-separated text,
// with names containing commas wrapped in quotes ("Little, Brown").
// ---------------------------------------------------------------------------

export function parseImprints(text: unknown): string[] {
  const s = String(text ?? "").trim();
  if (!s) return [];
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of s) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function serialiseImprints(imprints: string[]): string {
  return imprints
    .map((im) => (im.includes(",") ? `"${im}"` : im))
    .join(", ");
}

// ---------------------------------------------------------------------------
// Batching (C3): pending lines group by publisher × account — one email per
// rep per account; different sources DO merge within one pairing.
// ---------------------------------------------------------------------------

export interface HubBatch {
  key: string; // `${publisherId}|${account}`
  publisherId: string;
  account: Location;
  lines: HubLine[];
  sources: HubSource[];
  /** Estimated cost; null lines (unknown rrp/rate) excluded from the sum. */
  total: number;
  /** Sending is blocked without the matching account number (C6). */
  accountNumber: string;
  blocked: boolean;
}

export function batchPending(lines: HubLine[], publishers: HubPublisher[]): HubBatch[] {
  const byKey = new Map<string, HubLine[]>();
  for (const l of lines) {
    if (l.state !== "pending" || !l.account) continue;
    const key = `${l.publisherId ?? "unknown"}|${l.account}`;
    const bucket = byKey.get(key) ?? [];
    bucket.push(l);
    byKey.set(key, bucket);
  }
  return [...byKey.entries()].map(([key, batchLines]) => {
    const [publisherId, account] = key.split("|") as [string, Location];
    const pub = publishers.find((p) => p.id === publisherId);
    const accountNumber = pub?.accountNumbers[account] ?? "";
    const total = batchLines.reduce((sum, l) => sum + (lineCost(l, pub) ?? 0), 0);
    return {
      key,
      publisherId,
      account,
      lines: batchLines,
      sources: [...new Set(batchLines.map((l) => l.source))],
      total,
      accountNumber,
      blocked: !accountNumber || !pub,
    };
  });
}

// ---------------------------------------------------------------------------
// Fulfilment paths (C3): formatted order email + CSV. The exact sent copy is
// stored against the batch.
// ---------------------------------------------------------------------------

export function orderReference(account: Location, now = new Date()): string {
  const d = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `${account === "Simply Books" ? "SB" : "PR"}-${d}`;
}

export function composeOrderEmail(
  batch: HubBatch,
  pub: HubPublisher,
  senderName: string
): { subject: string; body: string } {
  const shop = batch.account;
  const repFirst = pub.repName.trim().split(/\s+/)[0] || "there";
  const ref = orderReference(batch.account);
  const linesText = batch.lines
    .map((l) => `• ${l.title} — ISBN ${l.isbn || "TBC"} — ${l.quantity} ${l.quantity === 1 ? "copy" : "copies"}`)
    .join("\n");
  return {
    subject: `${shop} order — acct ${batch.accountNumber} — ref ${ref}`,
    body:
      `Hi ${repFirst},\n\n` +
      `Please could we order the following for our ${shop} account (${batch.accountNumber}), ref ${ref}:\n\n` +
      `${linesText}\n\n` +
      `Delivery to our usual address. Could you confirm a rough ETA?\n\n` +
      `Thanks,\n${senderName}\n${shop}`,
  };
}

export function batchCsv(batch: HubBatch): string {
  const head = "Title,ISBN,Quantity,Account number,Source";
  const cell = (s: string | number) => {
    const v = String(s ?? "");
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const rows = batch.lines.map((l) =>
    [cell(l.title), cell(l.isbn), l.quantity, cell(batch.accountNumber), cell(HUB_SOURCES[l.source].label)].join(",")
  );
  return [head, ...rows].join("\n");
}
