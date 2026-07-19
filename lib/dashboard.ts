import type { VenueKey } from "@/lib/config";
import { VENUES, canonicalStatus, venueKeyOf } from "@/lib/config";
import type {
  ClubMembership,
  Club,
  HubLine,
  HubPublisher,
  Location,
  Member,
  Order,
  Pitch,
  RestockItem,
  ReturnRequest,
  ShowEvent,
} from "@/lib/types";
import type { LumaPreview } from "@/lib/event-operations";
import { pitchStage } from "@/lib/pitching";
import { lineCost } from "@/lib/hub";
import { RETURN_STATUSES, estimatedCredit, isReturnOverdue, waitingDays } from "@/lib/returns";
import type { ShiftEntry } from "@/lib/briefing";
import type { VenueSalesReport } from "@/lib/data/sales-source";

// ---------------------------------------------------------------------------
// Management Dashboard (management-dashboard-spec.md + "Management
// Dashboard.dc.html"). Pure aggregation helpers: the API route fetches the
// domain arrays from each module's data seam and this file turns them into
// the payload the page renders. Everything here is synchronous and
// deterministic so it unit-tests without any seam.
// ---------------------------------------------------------------------------

/** "Orders to make today" = needs-ordering backlog; older than this many
 *  days counts as overdue (TBC with Ben — mirrors the To Order screen's
 *  same-day expectation with a weekend's grace). */
export const ORDERS_OVERDUE_DAYS = 2;

/** Pre-sale pace: an event ≤7 days out with under 40% of capacity sold is
 *  flagged slow (heuristic, TBC with Ben). */
export const SLOW_PACE_RATIO = 0.4;

export const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

export const gbpK = (n: number) =>
  n >= 1000 ? `£${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k` : gbp(n);

export function daysBetween(fromIso: string, now: number): number {
  const from = new Date(fromIso).getTime();
  if (!Number.isFinite(from)) return 0;
  return Math.max(0, Math.floor((now - from) / 86_400_000));
}

/** % change vs a comparator. null = no comparator (prev 0 or missing). */
export function pctDelta(cur: number, prev: number | null | undefined): number | null {
  if (prev == null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

// ---------------------------------------------------------------------------
// Payload types (shared with the client page)
// ---------------------------------------------------------------------------

export type ChipTone = "warn" | "action" | "slow" | "good" | "quiet";

export interface DashboardTile {
  key: "returns-pick" | "orders-today" | "failed-payments" | "hub-drafts" | "events-week" | "pitches";
  value: string;
  label: string;
  sub: string;
  flag?: { text: string; tone: ChipTone };
}

export interface OpsRow {
  main: string;
  sub?: string;
  right?: string;
  chip?: { text: string; tone: ChipTone };
}

export interface DashboardOpsCard {
  key: "orders" | "hub" | "returns" | "clubs" | "events" | "restock" | "staffing";
  title: string;
  count?: string;
  rows: OpsRow[];
  linkLabel: string;
}

export interface TrendDelta {
  text: string;
  good: boolean;
  dir: "up" | "down";
}

export type TrendChart =
  | { type: "spark"; data: number[] }
  | { type: "bars"; items: { label: string; value: number; disp: string }[] };

export interface DashboardTrendCard {
  key: "membership" | "turnaround" | "returns-value" | "margin";
  title: string;
  kpi?: { value: string; label: string; delta?: TrendDelta };
  chart: TrendChart;
  foot?: string;
}

export interface DashboardPayload {
  date: string;
  /** True while the sales seam is the mock — the page labels the figures. */
  salesSample: boolean;
  /** Visible venues only, in display order (Prologue first, as the design). */
  sales: VenueSalesReport[];
  tiles: DashboardTile[];
  ops: DashboardOpsCard[];
  trends: DashboardTrendCard[];
}

// ---------------------------------------------------------------------------
// Quick-look tiles
// ---------------------------------------------------------------------------

export function ordersBacklog(orders: Order[]): { open: Order[]; overdue: Order[] } {
  const open = orders.filter((o) => canonicalStatus(o.status).key === "needs-ordering");
  const now = Date.now();
  return { open, overdue: open.filter((o) => daysBetween(o.orderDate, now) > ORDERS_OVERDUE_DAYS) };
}

export function failedPayments(memberships: ClubMembership[], clubs: Club[], visible: Location[]): ClubMembership[] {
  const clubLoc = new Map(clubs.map((c) => [c.id, c.location] as const));
  return memberships.filter((m) => {
    const loc = clubLoc.get(m.clubId);
    return m.status !== "cancelled" && m.payStatus !== "ok" && loc != null && visible.includes(loc);
  });
}

/** Value of a hub line, degrading gracefully: discounted cost when the
 *  publisher rate is known, RRP × qty otherwise, £0 when no price at all. */
export function hubLineValue(line: HubLine, publishers: Map<string, HubPublisher>): number {
  const pub = line.publisherId ? publishers.get(line.publisherId) : null;
  return lineCost(line, pub) ?? (line.rrp ?? 0) * line.quantity;
}

export interface PaceEntry {
  event: ShowEvent;
  luma: LumaPreview;
  ratio: number | null; // approved/capacity, null when unknown
  slow: boolean;
  soldOut: boolean;
}

export function paceOf(event: ShowEvent, luma: LumaPreview, today: string): PaceEntry {
  const known = luma.connected && luma.capacity > 0;
  const ratio = known ? luma.approved / luma.capacity : null;
  const daysOut = Math.round((new Date(`${event.date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
  return {
    event,
    luma,
    ratio,
    soldOut: known && luma.status === "sold_out",
    slow: ratio != null && luma.status === "on_sale" && ratio < SLOW_PACE_RATIO && daysOut <= 7,
  };
}

export function buildTiles(input: {
  returns: ReturnRequest[];
  orders: Order[];
  memberships: ClubMembership[];
  clubs: Club[];
  visible: Location[];
  hubDrafts: HubLine[];
  publishers: Map<string, HubPublisher>;
  weekEvents: PaceEntry[];
  pitches: Pitch[];
}): DashboardTile[] {
  const toPick = input.returns.filter((r) => r.status === "approved").length;
  const { open, overdue } = ordersBacklog(input.orders);
  const failed = failedPayments(input.memberships, input.clubs, input.visible).length;
  const draftValue = input.hubDrafts.reduce((s, l) => s + hubLineValue(l, input.publishers), 0);
  const slow = input.weekEvents.filter((e) => e.slow).length;
  const deciding = input.pitches.filter((p) => pitchStage(p.status).key === "to-review").length;
  return [
    { key: "returns-pick", value: String(toPick), label: "Returns to pick", sub: "Approved, ready to ship" },
    {
      key: "orders-today",
      value: String(open.length),
      label: "Orders to make today",
      sub: "Overdue-to-order backlog",
      ...(overdue.length ? { flag: { text: `${overdue.length} overdue`, tone: "slow" as const } } : {}),
    },
    {
      key: "failed-payments",
      value: String(failed),
      label: "Failed book-club payments",
      sub: failed ? "Cards need re-trying" : "All subscriptions healthy",
      ...(failed ? { flag: { text: "action", tone: "warn" as const } } : {}),
    },
    {
      key: "hub-drafts",
      value: gbp(draftValue),
      label: "Unsent hub drafts",
      sub: `${input.hubDrafts.length} line${input.hubDrafts.length === 1 ? "" : "s"} staged, not sent`,
    },
    {
      key: "events-week",
      value: String(input.weekEvents.length),
      label: "Events this week",
      sub: "Pre-sale pace tracked",
      ...(slow ? { flag: { text: `${slow} slow`, tone: "slow" as const } } : {}),
    },
    { key: "pitches", value: String(deciding), label: "Pitches to decide", sub: "Awaiting a decision" },
  ];
}

// ---------------------------------------------------------------------------
// Operational cards
// ---------------------------------------------------------------------------

function topGroups<T>(rows: T[], keyOf: (r: T) => string, limit: number): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return new Map([...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, limit));
}

export function buildOpsCards(input: {
  orders: Order[];
  hubDrafts: HubLine[];
  publishers: Map<string, HubPublisher>;
  returns: ReturnRequest[];
  memberships: ClubMembership[];
  clubs: Club[];
  members: Member[];
  visible: Location[];
  weekEvents: PaceEntry[];
  restock: RestockItem[];
  roster: { venue: VenueKey; entries: ShiftEntry[]; hours: string }[] | null;
}): DashboardOpsCard[] {
  const now = Date.now();
  const cards: DashboardOpsCard[] = [];

  // Orders: needs-ordering backlog grouped by publisher, oldest first.
  const { open } = ordersBacklog(input.orders);
  const byPublisher = topGroups(open, (o) => o.publisher || "No publisher set", 3);
  cards.push({
    key: "orders",
    title: "Orders to make",
    count: `${open.length} line${open.length === 1 ? "" : "s"}`,
    linkLabel: "Open Customer ordering",
    rows: [...byPublisher.entries()].map(([publisher, rows]) => {
      const oldest = Math.max(...rows.map((o) => daysBetween(o.orderDate, now)));
      const value = rows.reduce((s, o) => s + (o.price ?? 0) * o.quantity, 0);
      return {
        main: publisher,
        sub: `${rows.length} line${rows.length === 1 ? "" : "s"} · oldest ${oldest} day${oldest === 1 ? "" : "s"}`,
        ...(value ? { right: gbp(value) } : {}),
        ...(oldest > ORDERS_OVERDUE_DAYS ? { chip: { text: "Overdue", tone: "warn" as const } } : {}),
      };
    }),
  });

  // Ordering Hub: unsent draft value by trading account.
  const draftValue = input.hubDrafts.reduce((s, l) => s + hubLineValue(l, input.publishers), 0);
  const byAccount = topGroups(input.hubDrafts, (l) => l.account ?? "No account", 3);
  cards.push({
    key: "hub",
    title: "Unsent Ordering Hub drafts",
    count: gbp(draftValue),
    linkLabel: "Open Ordering Hub",
    rows: [...byAccount.entries()].map(([account, rows]) => {
      const pubs = [...new Set(rows.map((l) => (l.publisherId && input.publishers.get(l.publisherId)?.name) || l.imprint || "Unassigned"))];
      return {
        main: account,
        sub: `${pubs.slice(0, 2).join(", ")}${pubs.length > 2 ? ` +${pubs.length - 2}` : ""} · ${rows.length} line${rows.length === 1 ? "" : "s"}`,
        right: gbp(rows.reduce((s, l) => s + hubLineValue(l, input.publishers), 0)),
      };
    }),
  });

  // Returns: outstanding by stage with aging.
  const stages: { status: ReturnRequest["status"]; label: string; sub: string }[] = [
    { status: "awaiting", label: "Awaiting approval", sub: "RA requested" },
    { status: "approved", label: "Approved — ready to pick", sub: "Ready to ship" },
    { status: "shipped", label: "Shipped — awaiting credit", sub: "Credit note due" },
  ];
  const outstanding = input.returns.filter((r) => r.status !== "requested" && r.status !== "credit");
  cards.push({
    key: "returns",
    title: "Returns outstanding",
    count: String(outstanding.length),
    linkLabel: "Open Returns",
    rows: stages.map(({ status, label, sub }) => {
      const rows = outstanding.filter((r) => r.status === status);
      const oldest = rows.length ? Math.max(...rows.map((r) => waitingDays(r, now))) : 0;
      const overdue = rows.some((r) => isReturnOverdue(r, now));
      return {
        main: label,
        sub: rows.length ? `Oldest ${oldest} working day${oldest === 1 ? "" : "s"}` : sub,
        right: String(rows.length),
        ...(overdue
          ? { chip: { text: `${oldest}wd`, tone: "warn" as const } }
          : status === "approved" && rows.length
            ? { chip: { text: "Action", tone: "action" as const } }
            : {}),
      };
    }),
  });

  // Book clubs: the failed-payment detail behind the tile.
  const memberName = new Map(input.members.map((m) => [m.id, m.name] as const));
  const clubName = new Map(input.clubs.map((c) => [c.id, c.name] as const));
  const failed = failedPayments(input.memberships, input.clubs, input.visible);
  cards.push({
    key: "clubs",
    title: "Book-club failed payments",
    count: String(failed.length),
    linkLabel: "Open Book Clubs",
    rows: failed.slice(0, 4).map((m) => ({
      main: memberName.get(m.memberId) ?? "Member",
      sub: `${clubName.get(m.clubId) ?? "Club"} · ${m.cardLabel || "card on file"}`,
      right: `£${m.amount.toFixed(2)}`,
      ...(m.payStatus === "past_due" ? { chip: { text: "Chase", tone: "warn" as const } } : {}),
    })),
  });

  // Events: pre-sale pace this week (existing Luma sync).
  cards.push({
    key: "events",
    title: "Event pre-sale pace",
    linkLabel: "Open Events",
    rows: input.weekEvents.slice(0, 4).map((p) => {
      const day = p.event.date
        ? new Date(`${p.event.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short" })
        : "TBC";
      return {
        main: p.event.name,
        sub: `${day} · ${p.event.venueName || VENUES[venueKeyOf(p.event.location ?? "Prologue")].label}`,
        right: p.luma.connected ? `${p.luma.approved}/${p.luma.capacity}` : "—",
        ...(p.soldOut
          ? { chip: { text: "Sold out", tone: "good" as const } }
          : p.slow
            ? { chip: { text: "Slow", tone: "slow" as const } }
            : !p.luma.connected
              ? { chip: { text: "No Luma", tone: "quiet" as const } }
              : {}),
      };
    }),
  });

  // Restock: captured flags with no arrival tracking — easy to lose sight of.
  const flagged = input.restock.filter((r) => !r.handledAt);
  cards.push({
    key: "restock",
    title: "Restock flags",
    count: flagged.length ? String(flagged.length) : undefined,
    linkLabel: "Open Restock",
    rows: flagged.slice(0, 3).map((r) => ({
      main: r.title,
      sub: `${r.supplier || "Supplier TBC"} · flagged by ${r.by}`,
      right: `×${r.quantity}`,
      ...(daysBetween(r.createdAt, now) > 3 ? { chip: { text: `${daysBetween(r.createdAt, now)}d`, tone: "slow" as const } } : {}),
    })),
  });

  // Staffing: who's on today (Daily Briefing's Deputy pull, reused).
  if (input.roster) {
    cards.push({
      key: "staffing",
      title: "On shift today",
      linkLabel: "Open Daily Briefing",
      rows: input.roster.map(({ venue, entries, hours }) => {
        const lead = entries[0];
        return {
          main: VENUES[venue].label,
          sub: entries.length
            ? `${lead.name}${lead.role ? ` (${lead.role})` : ""}${entries.length > 1 ? ` +${entries.length - 1}` : ""}${hours ? ` · ${hours}` : ""}`
            : "Nobody rostered",
          right: `${entries.length} on`,
        };
      }),
    });
  }

  // Never render an empty shell: cards with no rows drop out (e.g. no
  // restock flags is good news, not an empty card).
  return cards.filter((c) => c.rows.length > 0);
}

// ---------------------------------------------------------------------------
// Trend cards
// ---------------------------------------------------------------------------

const monthKey = (iso: string) => iso.slice(0, 7);

export function buildTrendCards(input: {
  memberships: ClubMembership[];
  clubs: Club[];
  visible: Location[];
  orders: Order[];
  returns: ReturnRequest[];
  publishers: Map<string, HubPublisher>;
  hubLines: HubLine[];
  today: string;
}): DashboardTrendCard[] {
  const cards: DashboardTrendCard[] = [];
  const clubLoc = new Map(input.clubs.map((c) => [c.id, c.location] as const));
  const inScope = (clubId: string) => {
    const loc = clubLoc.get(clubId);
    return loc != null && input.visible.includes(loc);
  };

  // Membership: active count + cumulative-joins series (an approximation —
  // we hold no historical snapshots; churn needs Stripe history, later).
  const active = input.memberships.filter((m) => m.status === "active" && inScope(m.clubId));
  const months: string[] = [];
  for (let i = 8; i >= 0; i--) {
    const d = new Date(`${input.today}T12:00:00`);
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  const series = months.map((m) => active.filter((s) => monthKey(s.joined) <= m).length);
  const joined30 = active.filter((m) => daysBetween(m.joined, Date.now()) <= 30).length;
  const recurring = active.reduce((s, m) => s + m.amount, 0);
  cards.push({
    key: "membership",
    title: "Book-club membership",
    kpi: {
      value: String(active.length),
      label: "active members",
      ...(joined30 ? { delta: { text: `+${joined30}`, good: true, dir: "up" as const } } : {}),
    },
    chart: { type: "spark", data: series },
    foot: `Recurring ${gbp(recurring)} / mo · joins last 30 days: ${joined30}`,
  });

  // Fulfilment turnaround: average order age at completion, by week.
  const completed = input.orders
    .filter((o) => canonicalStatus(o.status).key === "collected")
    .map((o) => ({
      week: Math.floor((new Date(input.today).getTime() - new Date(o.lastModified).getTime()) / (7 * 86_400_000)),
      days: Math.max(0, (new Date(o.lastModified).getTime() - new Date(o.orderDate).getTime()) / 86_400_000),
    }))
    .filter((o) => o.week >= 0 && o.week < 8);
  if (completed.length >= 3) {
    const byWeek: number[] = [];
    for (let w = 7; w >= 0; w--) {
      const rows = completed.filter((o) => o.week === w);
      byWeek.push(rows.length ? rows.reduce((s, o) => s + o.days, 0) / rows.length : byWeek[byWeek.length - 1] ?? 0);
    }
    const avg = completed.reduce((s, o) => s + o.days, 0) / completed.length;
    const lastTwo = byWeek.slice(-2);
    const improving = lastTwo[1] <= lastTwo[0];
    cards.push({
      key: "turnaround",
      title: "Order fulfilment turnaround",
      kpi: {
        value: `${avg.toFixed(1)} days`,
        label: "avg time to collected",
        delta: {
          text: `${improving ? "−" : "+"}${Math.abs(lastTwo[1] - lastTwo[0]).toFixed(1)}d`,
          good: improving,
          dir: improving ? "down" : "up",
        },
      },
      chart: { type: "spark", data: byWeek.map((d) => Number(d.toFixed(2))) },
      foot: `${completed.length} orders completed · last 8 weeks`,
    });
  }

  // Returns value by publisher — credit confirmed in the last 90 days.
  const cutoff = new Date(new Date(`${input.today}T12:00:00`).getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
  const credited = input.returns.filter((r) => r.status === "credit" && (r.dateCreditConfirmed ?? "") >= cutoff);
  const byPub = new Map<string, number>();
  for (const r of credited) {
    const name = (r.publisherId && input.publishers.get(r.publisherId)?.name) || "Other";
    const pub = r.publisherId ? input.publishers.get(r.publisherId) : null;
    byPub.set(name, (byPub.get(name) ?? 0) + (r.creditAmount ?? estimatedCredit(r, pub)));
  }
  const pubItems = [...byPub.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (pubItems.length) {
    cards.push({
      key: "returns-value",
      title: "Returns value by publisher",
      chart: { type: "bars", items: pubItems.map(([label, value]) => ({ label, value, disp: gbp(value) })) },
      foot: "Credit confirmed · last 90 days",
    });
  }

  // Discount / margin exposure: stock ordered at negotiated rate this month,
  // by order type (rates vary meaningfully by publisher × type).
  const thisMonth = monthKey(input.today);
  const sentLines = input.hubLines.filter((l) => (l.state === "ordered" || l.state === "arrived") && l.sentAt && monthKey(l.sentAt) === thisMonth);
  const typeLabel: Record<HubLine["orderType"], string> = { restock: "Restock", bookclub: "Book club", events: "Events", schools: "Schools" };
  const byType = new Map<string, number>();
  for (const line of sentLines) {
    const label = typeLabel[line.orderType];
    byType.set(label, (byType.get(label) ?? 0) + hubLineValue(line, input.publishers));
  }
  const typeItems = [...byType.entries()].sort((a, b) => b[1] - a[1]);
  if (typeItems.length) {
    cards.push({
      key: "margin",
      title: "Discount / margin exposure",
      chart: { type: "bars", items: typeItems.map(([label, value]) => ({ label, value, disp: gbpK(value) })) },
      foot: "Stock ordered at negotiated rate, by order type · this month",
    });
  }

  return cards;
}

// Assessed for the spec's caching question: every source list above is
// already served from each seam's 30s server-side cache (Airtable 5 rps
// guard), and the whole aggregation is a single pass over those arrays —
// so the dashboard stays query-on-demand. A scheduled aggregation table
// only becomes worth it when trend cards need TRUE history (member churn,
// week-on-week sales snapshots) rather than what today's records imply;
// that lands with the Square/Stripe live phase.
