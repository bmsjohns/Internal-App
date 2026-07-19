import { describe, expect, it } from "vitest";
import type { HubLine, HubPublisher } from "@/lib/types";
import {
  batchCsv,
  batchPending,
  composeOrderEmail,
  costEach,
  draftAgeDays,
  isOverridden,
  isStaleDraft,
  rateFor,
} from "@/lib/hub";
import { parseImprints, serialiseImprints } from "@/lib/hub";
import { currentMonthKey, monthLabel, nthWeekdayDate, prettyCadence, recentMonthKeys } from "@/lib/clubs";
import { normaliseStripeEvent } from "@/lib/stripe";

const pub = (over: Partial<HubPublisher> = {}): HubPublisher => ({
  id: "p1",
  name: "Penguin Random House",
  repName: "Marcus Reed",
  repEmail: "rep@prh.co.uk",
  accountNumbers: { "Simply Books": "PRH-SB-1", "Prologue": "PRH-PR-2" },
  imprints: ["Vintage"],
  rates: { restock: 48, bookclub: 50, events: 52, schools: null },
  accountOverrides: {},
  ...over,
});

const line = (over: Partial<HubLine> = {}): HubLine => ({
  id: "L1",
  title: "Orbital",
  isbn: "9781529922936",
  quantity: 10,
  publisherId: "p1",
  imprint: "Vintage",
  rrp: 10,
  source: "bookclub",
  sourceLabel: "Book Club — Far Horizons",
  sourceLink: "sel1",
  account: "Prologue",
  orderType: "bookclub",
  state: "pending",
  draftKey: null,
  createdAt: new Date().toISOString(),
  sentAt: null,
  sentBy: "",
  sentMethod: "",
  sentCopy: "",
  arrivedAt: null,
  log: [],
  ...over,
});

describe("discount rates (C6)", () => {
  it("uses the publisher × order-type rate", () => {
    expect(rateFor(pub(), "bookclub", "Prologue")).toBe(50);
  });
  it("falls back to the restock base when a type has no own rate", () => {
    expect(rateFor(pub(), "schools", "Simply Books")).toBe(48);
  });
  it("applies the rare per-account override and flags it", () => {
    const p = pub({ accountOverrides: { Prologue: { restock: 52 } } });
    expect(rateFor(p, "restock", "Prologue")).toBe(52);
    expect(rateFor(p, "restock", "Simply Books")).toBe(48);
    expect(isOverridden(p, "restock", "Prologue")).toBe(true);
    expect(isOverridden(p, "restock", "Simply Books")).toBe(false);
  });
  it("is a straight percentage off RRP — no volume logic", () => {
    expect(costEach(10, 50)).toBe(5);
    expect(costEach(null, 50)).toBeNull();
    expect(costEach(10, null)).toBeNull();
  });
});

describe("batching (C3)", () => {
  it("groups by publisher × account; sources merge within a pairing", () => {
    const batches = batchPending(
      [
        line({ id: "a", source: "bookclub" }),
        line({ id: "b", source: "events" }),
        line({ id: "c", account: "Simply Books" }),
        line({ id: "d", publisherId: "p2" }),
      ],
      [pub(), pub({ id: "p2", name: "Faber" })]
    );
    const keys = batches.map((b) => b.key).sort();
    expect(keys).toEqual(["p1|Prologue", "p1|Simply Books", "p2|Prologue"]);
    const merged = batches.find((b) => b.key === "p1|Prologue")!;
    expect(merged.lines).toHaveLength(2);
    expect(merged.sources.sort()).toEqual(["bookclub", "events"]);
  });
  it("never batches drafts, ordered, arrived or account-less lines", () => {
    const batches = batchPending(
      [line({ state: "draft" }), line({ state: "ordered" }), line({ account: null })],
      [pub()]
    );
    expect(batches).toHaveLength(0);
  });
  it("blocks a batch whose account number is missing (C6)", () => {
    const p = pub({ accountNumbers: { "Simply Books": "X", "Prologue": "" } });
    const [batch] = batchPending([line()], [p]);
    expect(batch.blocked).toBe(true);
  });
  it("totals cost after discount", () => {
    const [batch] = batchPending([line()], [pub()]); // £10 rrp, 50%, ×10
    expect(batch.total).toBe(50);
  });
});

describe("send artefacts (C3)", () => {
  it("email carries the account number for the chosen account and all lines", () => {
    const [batch] = batchPending([line()], [pub()]);
    const { subject, body } = composeOrderEmail(batch, pub(), "Ben");
    expect(subject).toContain("PRH-PR-2");
    expect(body).toContain("PRH-PR-2");
    expect(body).toContain("Orbital — ISBN 9781529922936 — 10 copies");
    expect(body).toContain("Hi Marcus");
  });
  it("CSV includes header, quantities and the account number", () => {
    const [batch] = batchPending([line()], [pub()]);
    const csv = batchCsv(batch);
    expect(csv.split("\n")[0]).toBe("Title,ISBN,Quantity,Account number,Source");
    expect(csv).toContain("Orbital,9781529922936,10,PRH-PR-2,Book Club");
  });
});

describe("stale drafts (C2)", () => {
  it("flags a draft sitting 7+ days; pending lines never flag", () => {
    const old = new Date(Date.now() - 8 * 864e5).toISOString();
    expect(isStaleDraft(line({ state: "draft", createdAt: old }))).toBe(true);
    expect(isStaleDraft(line({ state: "draft" }))).toBe(false);
    expect(isStaleDraft(line({ state: "pending", createdAt: old }))).toBe(false);
    expect(draftAgeDays(old)).toBe(8);
  });
});

describe("month helpers", () => {
  it("labels a month key in English", () => {
    expect(monthLabel("2026-07")).toBe("July 2026");
  });
  it("produces recent keys newest first and matches currentMonthKey shape", () => {
    expect(recentMonthKeys(3, "2026-01")).toEqual(["2026-01", "2025-12", "2025-11"]);
    expect(currentMonthKey()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("live-base mapping helpers", () => {
  it("prettifies the Session Time formula into a cadence", () => {
    expect(prettyCadence("Week 2 - Wednesday - 8pm")).toBe("2nd Wednesday · 8pm");
    expect(prettyCadence("Week 1 - Monday - 1pm")).toBe("1st Monday · 1pm");
    expect(prettyCadence(" -  - ")).toBe("");
    expect(prettyCadence(" - Wednesday - 11am")).toBe("Wednesday · 11am");
  });
  it("finds the Nth weekday session date for a month", () => {
    // July 2026: Wednesdays fall on 1, 8, 15, 22, 29.
    expect(nthWeekdayDate("2026-07", "Week 2", "Wednesday")).toBe("2026-07-08");
    expect(nthWeekdayDate("2026-07", "Week 4", "Wednesday")).toBe("2026-07-22");
    // 3rd Thursday of July 2026 = 16th (Ben's example pattern).
    expect(nthWeekdayDate("2026-07", "Week 3", "Thursday")).toBe("2026-07-16");
    expect(nthWeekdayDate("2026-07", "", "Wednesday")).toBeNull();
  });
  it("parses comma-separated imprints with quoted names", () => {
    expect(parseImprints('Headline, "Little, Brown", Abacus')).toEqual(["Headline", "Little, Brown", "Abacus"]);
    expect(parseImprints("")).toEqual([]);
    expect(serialiseImprints(["Headline", "Little, Brown"])).toBe('Headline, "Little, Brown"');
  });
});

describe("stripe webhook normalisation (B2)", () => {
  it("maps failed invoices to a failed pay status", () => {
    const evt = normaliseStripeEvent({ type: "invoice.payment_failed", data: { object: { subscription: "sub_1" } } });
    expect(evt).toEqual({ type: "invoice.payment_failed", subscriptionId: "sub_1", payStatus: "failed" });
  });
  it("maps deletion to cancelled and pause_collection to paused", () => {
    expect(
      normaliseStripeEvent({ type: "customer.subscription.deleted", data: { object: { id: "sub_2", status: "canceled" } } })
        ?.status
    ).toBe("cancelled");
    expect(
      normaliseStripeEvent({
        type: "customer.subscription.updated",
        data: { object: { id: "sub_3", status: "active", pause_collection: { behavior: "void" } } },
      })?.status
    ).toBe("paused");
  });
  it("ignores events we don't act on", () => {
    expect(normaliseStripeEvent({ type: "charge.succeeded", data: { object: {} } })).toBeNull();
  });
});
