import { describe, expect, it } from "vitest";
import type { HubPublisher, ReturnLine, ReturnRequest } from "@/lib/types";
import {
  estimatedCredit,
  groupStaging,
  isReturnOverdue,
  matchPickScan,
  outstandingCsv,
  pickComplete,
  returnAccountNumber,
  returnUnits,
  routeLabel,
  statusIndex,
  waitingDays,
  workingDaysSince,
} from "@/lib/returns";

const daysAgo = (d: number) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);

const pub = (over: Partial<HubPublisher> = {}): HubPublisher => ({
  id: "p1",
  name: "Faber & Faber",
  repName: "Ellie Doran",
  repEmail: "rep@faber.co.uk",
  accountNumbers: { "Simply Books": "FAB-SB-1", "Prologue": "FAB-PR-2" },
  imprints: ["Faber"],
  rates: { restock: 50, bookclub: null, events: null, schools: null },
  accountOverrides: {},
  ...over,
});

const line = (over: Partial<ReturnLine> = {}): ReturnLine => ({
  id: "l1",
  title: "Intermezzo",
  isbn: "9780571391110",
  quantity: 4,
  reason: "slow-moving",
  condition: "new",
  rrp: 20,
  picked: 0,
  ...over,
});

const req = (over: Partial<ReturnRequest> = {}): ReturnRequest => ({
  id: "r1",
  code: "RTN-0001",
  location: "Prologue",
  origin: "general",
  eventRef: "",
  eventId: null,
  verifiedBy: "",
  publisherId: "p1",
  route: "direct",
  status: "awaiting",
  raNumber: "",
  raFilename: "",
  requestedBy: "Ben",
  dateRequested: daysAgo(10),
  dateSubmitted: daysAgo(8),
  dateApproved: null,
  dateShipped: null,
  dateCreditConfirmed: null,
  creditAmount: null,
  notes: "",
  lines: [line()],
  log: [],
  ...over,
});

describe("lifecycle ordering", () => {
  it("orders the five statuses", () => {
    expect(statusIndex("requested")).toBe(0);
    expect(statusIndex("credit")).toBe(4);
  });
  it("labels routes, including the unset state", () => {
    expect(routeLabel("direct")).toBe("Direct to publisher");
    expect(routeLabel("gardners")).toBe("Via Gardners");
    expect(routeLabel("")).toBe("No route yet");
  });
});

describe("waiting & overdue", () => {
  it("counts waiting from the current stage's date, not the request date", () => {
    expect(waitingDays(req({ dateRequested: daysAgo(30), dateSubmitted: daysAgo(8) }))).toBe(8);
  });
  it("is zero once credit is confirmed", () => {
    expect(waitingDays(req({ status: "credit", dateCreditConfirmed: daysAgo(2) }))).toBe(0);
  });
  // Fixed 2026 dates: Mon 13 Jul … Sun 19 Jul (13th is a Monday).
  const at = (iso: string) => new Date(iso + "T12:00:00Z").getTime();
  it("counts working days, skipping weekends", () => {
    expect(workingDaysSince("2026-07-13", at("2026-07-16"))).toBe(3); // Tue+Wed+Thu
    expect(workingDaysSince("2026-07-17", at("2026-07-20"))).toBe(1); // Fri→Mon: weekend skipped
    expect(workingDaysSince("2026-07-17", at("2026-07-19"))).toBe(0); // Fri→Sun: nothing yet
    expect(workingDaysSince(null)).toBe(0);
  });
  it("flags an awaiting return after 3 working days, not calendar days", () => {
    const submittedMon = req({ dateSubmitted: "2026-07-13" });
    expect(isReturnOverdue(submittedMon, at("2026-07-16"))).toBe(false); // Thu = 3 wd, on the line
    expect(isReturnOverdue(submittedMon, at("2026-07-17"))).toBe(true); // Fri = 4 wd
    const submittedThu = req({ dateSubmitted: "2026-07-16" });
    expect(isReturnOverdue(submittedThu, at("2026-07-19"))).toBe(false); // Sun = only Fri counted
  });
  it("flags a shipped return after 5 working days with no credit", () => {
    const shippedMon = req({ status: "shipped", dateShipped: "2026-07-06" });
    expect(isReturnOverdue(shippedMon, at("2026-07-13"))).toBe(false); // next Mon = 5 wd
    expect(isReturnOverdue(shippedMon, at("2026-07-14"))).toBe(true); // Tue = 6 wd
  });
  it("never flags requested or credited returns", () => {
    expect(isReturnOverdue(req({ status: "requested", dateRequested: daysAgo(99) }))).toBe(false);
    expect(isReturnOverdue(req({ status: "credit", dateCreditConfirmed: daysAgo(99) }))).toBe(false);
  });
});

describe("estimated credit", () => {
  it("uses the publisher's restock rate against RRP", () => {
    // 4 copies × £20 × 50% discount = £40 back
    expect(estimatedCredit(req(), pub())).toBe(40);
  });
  it("treats unknown rrp/publisher as zero rather than guessing", () => {
    expect(estimatedCredit(req({ lines: [line({ rrp: null })] }), pub())).toBe(0);
    expect(estimatedCredit(req(), null)).toBe(0);
  });
});

describe("staging groups (publisher × shop)", () => {
  it("groups requested returns and never combines shops", () => {
    const groups = groupStaging([
      req({ id: "a", status: "requested", location: "Prologue" }),
      req({ id: "b", status: "requested", location: "Prologue" }),
      req({ id: "c", status: "requested", location: "Simply Books" }),
      req({ id: "d", status: "awaiting" }), // not staging
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.location === "Prologue")?.requests.map((r) => r.id)).toEqual(["a", "b"]);
    expect(groups.find((g) => g.location === "Simply Books")?.requests).toHaveLength(1);
  });
  it("resolves the account number for the return's own shop", () => {
    expect(returnAccountNumber(req({ location: "Simply Books" }), pub())).toBe("FAB-SB-1");
    expect(returnAccountNumber(req({ location: "Prologue" }), pub())).toBe("FAB-PR-2");
  });
});

describe("pick scanning", () => {
  const r = req({
    status: "approved",
    lines: [line({ id: "l1", picked: 3 }), line({ id: "l2", isbn: "9781399813204", title: "Caledonian Road", quantity: 2 })],
  });
  it("confirms the next unpicked copy of a scanned ISBN", () => {
    expect(matchPickScan(r, "9780571391110")).toEqual({ ok: true, lineId: "l1", title: "Intermezzo" });
  });
  it("ignores barcode punctuation/spacing", () => {
    expect(matchPickScan(r, " 978-0571391110 ")).toMatchObject({ ok: true, lineId: "l1" });
  });
  it("rejects an ISBN that isn't on the list", () => {
    expect(matchPickScan(r, "9999999999999")).toEqual({ ok: false, reason: "not-on-list" });
  });
  it("rejects a title that's fully picked", () => {
    const full = req({ lines: [line({ picked: 4 })] });
    expect(matchPickScan(full, "9780571391110")).toEqual({ ok: false, reason: "already-picked" });
  });
  it("empty scan picks the next outstanding copy; all-picked reported", () => {
    expect(matchPickScan(r, "")).toMatchObject({ ok: true, lineId: "l1" });
    const done = req({ lines: [line({ picked: 4 })] });
    expect(matchPickScan(done, "")).toEqual({ ok: false, reason: "all-picked" });
  });
  it("pickComplete requires every line boxed", () => {
    expect(pickComplete(r)).toBe(false);
    expect(pickComplete(req({ lines: [line({ picked: 4 })] }))).toBe(true);
    expect(returnUnits(r)).toBe(6);
  });
});

describe("outstanding CSV", () => {
  it("escapes commas/quotes and includes the waiting age", () => {
    const r = req({
      publisherId: "p1",
      raNumber: 'RA "weird", yes',
      dateSubmitted: daysAgo(5),
    });
    const csv = outstandingCsv([r], [pub({ name: "Little, Brown" })]);
    const rows = csv.split("\n");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("Waiting (days)");
    expect(rows[1]).toContain('"Little, Brown"');
    expect(rows[1]).toContain('"RA ""weird"", yes"');
    expect(rows[1]).toContain(",5,");
  });
});
