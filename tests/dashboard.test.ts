import { describe, expect, it } from "vitest";
import type { Club, ClubMembership, HubLine, HubPublisher, Order } from "@/lib/types";
import {
  ORDERS_OVERDUE_DAYS,
  buildOpsCards,
  buildTiles,
  buildTrendCards,
  failedPayments,
  gbp,
  gbpK,
  hubLineValue,
  ordersBacklog,
  paceOf,
  pctDelta,
} from "@/lib/dashboard";
import { mockSalesSource } from "@/lib/data/sales-mock";
import type { LumaPreview } from "@/lib/event-operations";
import type { ShowEvent } from "@/lib/types";

const daysAgoIso = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

const order = (over: Partial<Order> = {}): Order => ({
  id: "o1",
  bookTitle: "Orbital",
  author: "Samantha Harvey",
  isbn: "9780224102530",
  customerIds: [],
  teamMember: "Ben",
  paid: "Paid",
  status: "Not Ordered",
  specialOrder: false,
  isPreorder: false,
  preorderPublicationDate: null,
  estimatedLeadTime: null,
  deliveryMethod: "Collection",
  location: "Simply Books",
  notes: "",
  publisher: "Vintage",
  price: 9.99,
  quantity: 1,
  statusLog: [],
  orderDate: daysAgoIso(1),
  lastModified: daysAgoIso(0),
  ...over,
});

const membership = (over: Partial<ClubMembership> = {}): ClubMembership => ({
  id: "m1",
  memberId: "p1",
  clubId: "c1",
  stripeSubscriptionId: "sub_1",
  status: "active",
  joined: "2026-05-04",
  payStatus: "ok",
  cardLabel: "•••• 4242",
  periodEnd: "2026-08-04",
  amount: 14.99,
  log: [],
  ...over,
});

const club = (over: Partial<Club> = {}): Club => ({
  id: "c1",
  name: "First Chapter Club",
  kind: "book-club",
  location: "Simply Books",
  description: "",
  genre: "",
  cadence: "First Tuesday · monthly",
  stripePriceId: "price_1",
  status: "active",
  memberCapacity: null,
  ...over,
});

const publisher = (over: Partial<HubPublisher> = {}): HubPublisher => ({
  id: "pub1",
  name: "Faber & Faber",
  repName: "",
  repEmail: "",
  accountNumbers: { "Simply Books": "SB-1", Prologue: "PR-1" },
  imprints: [],
  rates: { restock: 50, bookclub: null, events: null, schools: null },
  accountOverrides: {},
  ...over,
});

const hubLine = (over: Partial<HubLine> = {}): HubLine => ({
  id: "l1",
  title: "Intermezzo",
  isbn: "9780571365470",
  quantity: 2,
  receivedQuantity: 0,
  publisherId: "pub1",
  imprint: "Faber",
  rrp: 10,
  source: "bookclub",
  sourceLabel: "Book Club",
  sourceLink: "sel-1",
  account: "Simply Books",
  orderType: "restock",
  state: "draft",
  draftKey: "d1",
  createdAt: daysAgoIso(1),
  sentAt: null,
  sentBy: "",
  sentMethod: "",
  sentCopy: "",
  arrivedAt: null,
  log: [],
  ...over,
});

describe("dashboard helpers", () => {
  it("pctDelta handles zero/missing comparators", () => {
    expect(pctDelta(110, 100)).toBeCloseTo(10);
    expect(pctDelta(90, 100)).toBeCloseTo(-10);
    expect(pctDelta(50, 0)).toBeNull();
    expect(pctDelta(50, null)).toBeNull();
  });

  it("formats GBP", () => {
    expect(gbp(2340.4)).toBe("£2,340");
    expect(gbpK(8400)).toBe("£8.4k");
    expect(gbpK(12400)).toBe("£12k");
    expect(gbpK(640)).toBe("£640");
  });

  it("splits the needs-ordering backlog into open and overdue", () => {
    const orders = [
      order({ id: "a", orderDate: daysAgoIso(ORDERS_OVERDUE_DAYS + 2) }),
      order({ id: "b", orderDate: daysAgoIso(0) }),
      order({ id: "c", status: "Ordered" }),
    ];
    const { open, overdue } = ordersBacklog(orders);
    expect(open.map((o) => o.id)).toEqual(["a", "b"]);
    expect(overdue.map((o) => o.id)).toEqual(["a"]);
  });

  it("failedPayments respects location scope and skips cancelled subs", () => {
    const clubs = [club(), club({ id: "c2", location: "Prologue" })];
    const memberships = [
      membership({ id: "f1", payStatus: "failed" }),
      membership({ id: "f2", payStatus: "failed", clubId: "c2" }),
      membership({ id: "f3", payStatus: "failed", status: "cancelled" }),
      membership({ id: "ok" }),
    ];
    expect(failedPayments(memberships, clubs, ["Simply Books", "Prologue"]).map((m) => m.id)).toEqual(["f1", "f2"]);
    expect(failedPayments(memberships, clubs, ["Prologue"]).map((m) => m.id)).toEqual(["f2"]);
  });

  it("hubLineValue uses the discounted cost, then RRP, then zero", () => {
    const pubs = new Map([["pub1", publisher()]]);
    expect(hubLineValue(hubLine(), pubs)).toBeCloseTo(10); // 50% off £10 × 2
    expect(hubLineValue(hubLine({ publisherId: null }), pubs)).toBeCloseTo(20); // RRP fallback
    expect(hubLineValue(hubLine({ publisherId: null, rrp: null }), pubs)).toBe(0);
  });
});

describe("pace classification", () => {
  const event = (over: Partial<ShowEvent> = {}): ShowEvent =>
    ({
      id: "ev1",
      name: "Poetry & Pints",
      leadTitle: "",
      isbn: "",
      date: "2026-07-24",
      time: "19:00",
      venueId: null,
      venueName: "Prologue bar",
      location: "Prologue",
      hostId: null,
      hostName: "",
      types: [],
      ages: [],
      format: "",
      status: "Confirmed",
      fromPitchId: null,
      roles: [],
      schedule: [],
      legacyStaffing: [],
      bookTicket: null,
      ticketOnly: null,
      minOrder: null,
      lumaLink: "https://lu.ma/x",
      banners: false,
      callSheet: [],
      callSheetSent: false,
      salesReportSent: false,
      mediaCount: 0,
      notes: "",
      createdAt: daysAgoIso(30),
      ...over,
    }) as ShowEvent;

  const luma = (over: Partial<LumaPreview> = {}): LumaPreview =>
    ({
      connected: true,
      integration: "mock",
      canCreate: false,
      eventId: "evt-1",
      eventUrl: "https://lu.ma/x",
      calendar: { id: "prologue", name: "Prologue", slug: "prologue", location: "Prologue", active: true },
      availableCalendars: [],
      status: "on_sale",
      capacity: 50,
      approved: 18,
      pending: 0,
      waitlist: 0,
      declined: 0,
      complimentary: 0,
      checkedIn: 0,
      lastSyncedAt: "",
      ticketTypes: [],
      ...over,
    }) as LumaPreview;

  it("flags slow pace only near the event and under the threshold", () => {
    expect(paceOf(event(), luma(), "2026-07-19").slow).toBe(true);
    expect(paceOf(event(), luma({ approved: 40 }), "2026-07-19").slow).toBe(false);
    expect(paceOf(event({ date: "2026-08-15" }), luma(), "2026-07-19").slow).toBe(false);
    expect(paceOf(event(), luma({ status: "sold_out", approved: 50 }), "2026-07-19").soldOut).toBe(true);
    expect(paceOf(event(), luma({ connected: false }), "2026-07-19").ratio).toBeNull();
  });
});

describe("card builders", () => {
  it("buildTiles reports counts, values and flags", () => {
    const pubs = new Map([["pub1", publisher()]]);
    const tiles = buildTiles({
      returns: [],
      orders: [order({ orderDate: daysAgoIso(ORDERS_OVERDUE_DAYS + 3) })],
      memberships: [membership({ payStatus: "failed" })],
      clubs: [club()],
      visible: ["Simply Books", "Prologue"],
      hubDrafts: [hubLine()],
      publishers: pubs,
      weekEvents: [],
      pitches: [],
    });
    const byKey = Object.fromEntries(tiles.map((t) => [t.key, t]));
    expect(byKey["orders-today"].value).toBe("1");
    expect(byKey["orders-today"].flag?.text).toBe("1 overdue");
    expect(byKey["failed-payments"].value).toBe("1");
    expect(byKey["failed-payments"].flag?.tone).toBe("warn");
    expect(byKey["hub-drafts"].value).toBe("£10");
    expect(byKey["hub-drafts"].sub).toContain("1 line");
  });

  it("buildOpsCards drops empty cards and groups drafts by account", () => {
    const pubs = new Map([["pub1", publisher()]]);
    const cards = buildOpsCards({
      orders: [],
      hubDrafts: [hubLine(), hubLine({ id: "l2", account: "Prologue", quantity: 1 })],
      publishers: pubs,
      returns: [],
      memberships: [],
      clubs: [],
      members: [],
      visible: ["Simply Books", "Prologue"],
      weekEvents: [],
      restock: [],
      roster: null,
    });
    const keys = cards.map((c) => c.key);
    expect(keys).toEqual(["hub", "returns"]); // returns card keeps its 3 stage rows even at zero
    const hub = cards.find((c) => c.key === "hub")!;
    expect(hub.count).toBe("£15");
    expect(hub.rows).toHaveLength(2);
  });

  it("buildTrendCards approximates membership growth and margin exposure", () => {
    const pubs = new Map([["pub1", publisher()]]);
    const sent = hubLine({ id: "s1", state: "ordered", sentAt: new Date().toISOString(), orderType: "bookclub" });
    const cards = buildTrendCards({
      memberships: [membership(), membership({ id: "m2", joined: daysAgoIso(5).slice(0, 10) })],
      clubs: [club()],
      visible: ["Simply Books", "Prologue"],
      orders: [],
      returns: [],
      publishers: pubs,
      hubLines: [sent],
      today: new Date().toISOString().slice(0, 10),
    });
    const membershipCard = cards.find((c) => c.key === "membership")!;
    expect(membershipCard.kpi?.value).toBe("2");
    expect(membershipCard.kpi?.delta?.text).toBe("+1");
    const margin = cards.find((c) => c.key === "margin")!;
    expect(margin.chart).toEqual({ type: "bars", items: [{ label: "Book club", value: 10, disp: "£10" }] });
  });
});

describe("mock sales source", () => {
  it("is deterministic and internally consistent", async () => {
    const a = await mockSalesSource.getSales("2026-07-19");
    const b = await mockSalesSource.getSales("2026-07-19");
    expect(a).toEqual(b);

    for (const venue of ["prologue", "simply"] as const) {
      const report = a[venue];
      expect(report.daily).toHaveLength(28);
      expect(report.daily[27].date).toBe("2026-07-19");
      // Day figure equals the last daily point (combined).
      const day = report.periods.day;
      expect(day.square + (day.stripe ?? 0)).toBe(report.daily[27].total);
      // Month-to-date covers 19 days.
      const monthDays = report.daily.slice(-19).reduce((s, d) => s + d.total, 0);
      const month = report.periods.month;
      expect(month.square + (month.stripe ?? 0)).toBe(monthDays);
      // Categories sum to (rounded shares of) the Square total.
      const catSum = report.categories.month.reduce((s, c) => s + c.value, 0);
      expect(Math.abs(catSum - month.square)).toBeLessThan(5);
    }

    expect(a.prologue.stripeConnected).toBe(false);
    expect(a.prologue.periods.week.stripe).toBeNull();
    expect(a.simply.stripeConnected).toBe(true);
    expect(a.simply.periods.week.stripe).toBeGreaterThan(0);
  });
});
