import { describe, expect, it } from "vitest";
import { eventCostTotal, getEventOperationsPreview, readinessSummary } from "@/lib/event-operations";
import type { ShowEvent } from "@/lib/types";

const event = (patch: Partial<ShowEvent> = {}): ShowEvent => ({
  id: "ev-preview",
  name: "Preview author event",
  leadTitle: "The Preview Book",
  isbn: "9780000000001",
  date: "2026-09-12",
  time: "19:00",
  venueId: "venue-1",
  venueName: "Simply Books — Bramhall",
  location: "Simply Books",
  hostId: null,
  hostName: "",
  types: ["In-house"],
  ages: [],
  format: "",
  status: "Confirmed",
  fromPitchId: null,
  roles: [],
  schedule: [],
  legacyStaffing: [],
  bookTicket: 60,
  ticketOnly: 0,
  minOrder: 40,
  lumaLink: "https://lu.ma/preview",
  banners: false,
  callSheet: [],
  callSheetSent: false,
  salesReportSent: false,
  mediaCount: 0,
  notes: "",
  createdAt: "2026-07-01T10:00:00.000Z",
  ...patch,
});

describe("event operations preview", () => {
  it("generates deterministic Luma, task, and stock data without mutating the event", () => {
    const input = event();
    const first = getEventOperationsPreview(input);
    const second = getEventOperationsPreview(input);

    expect(first.mode).toBe("preview");
    expect(first.luma.connected).toBe(true);
    expect(first.luma.availableCalendars).toHaveLength(3);
    expect(first.luma.calendar.active).toBe(true);
    expect(first.luma.approved).toBe(second.luma.approved);
    expect(first.tasks).toHaveLength(10);
    expect(first.stock[0]).toMatchObject({ title: "The Preview Book", isbn: "9780000000001", reserved: expect.any(Number) });
    expect(first.stock[0].recommendedOrder).toBeGreaterThanOrEqual(first.stock[0].reserved + first.stock[0].walkUpForecast + first.stock[0].buffer);
    expect(first.stock[0].recommendedOrder).toBeGreaterThanOrEqual(40);
    expect(input).toEqual(event());
  });

  it("keeps an event without a Luma URL explicitly unlinked", () => {
    const operations = getEventOperationsPreview(event({ lumaLink: "" }));

    expect(operations.luma.connected).toBe(false);
    expect(operations.luma.ticketTypes).toEqual([]);
    expect(operations.luma.approved).toBe(0);
  });

  it("summarises completion and overdue work", () => {
    const operations = getEventOperationsPreview(event());
    const summary = readinessSummary(
      operations.tasks.map((task, index) => ({ ...task, status: index < 4 ? "done" : "todo" })),
      new Date("2026-09-01T12:00:00Z")
    );

    expect(summary).toMatchObject({ done: 4, total: 10, percent: 40 });
    expect(summary.overdue).toBeGreaterThan(0);
  });

  it("totals only the optional event costs that are present", () => {
    expect(eventCostTotal({ paymentFees: 18, vat: 62, staff: 240, venue: null, host: 120, other: null })).toBe(440);
  });
});
