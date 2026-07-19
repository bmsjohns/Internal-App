import { describe, expect, it } from "vitest";
import { isoAddDays, mondayDow, periodRanges, reportFromLedger, type SalesDayLedger } from "@/lib/data/sales-shared";
import { bucketOfCategoryName, londonDayRange } from "@/lib/data/sales-square";

// 70-day ledger ending 2026-07-19 (a Sunday) with £1/day so range maths is
// directly readable as day counts.
function flatLedger(endIso: string, days = 70): SalesDayLedger[] {
  const out: SalesDayLedger[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push({ date: isoAddDays(endIso, -i), square: 1, stripe: 1, cats: { retail: 0.6, cafe: 0.4 } });
  }
  return out;
}

describe("sales-shared period maths", () => {
  const ledger = flatLedger("2026-07-19");

  it("day = today vs yesterday", () => {
    const { cur, prev } = periodRanges(ledger, "day");
    expect(cur.map((d) => d.date)).toEqual(["2026-07-19"]);
    expect(prev.map((d) => d.date)).toEqual(["2026-07-18"]);
  });

  it("week to date runs Monday→today vs the same span last week", () => {
    expect(mondayDow("2026-07-19")).toBe(6); // Sunday
    const { cur, prev } = periodRanges(ledger, "week");
    expect(cur).toHaveLength(7);
    expect(cur[0].date).toBe("2026-07-13"); // Monday
    expect(prev).toHaveLength(7);
    expect(prev[0].date).toBe("2026-07-06");
    expect(prev[6].date).toBe("2026-07-12");
  });

  it("month to date compares the same elapsed days of last month", () => {
    const { cur, prev } = periodRanges(ledger, "month");
    expect(cur).toHaveLength(19);
    expect(cur[0].date).toBe("2026-07-01");
    expect(prev).toHaveLength(19);
    expect(prev[0].date).toBe("2026-06-01");
    expect(prev[18].date).toBe("2026-06-19");
  });

  it("clamps comparators when history is short instead of wrapping", () => {
    const short = flatLedger("2026-07-19", 3);
    const { prev } = periodRanges(short, "month");
    expect(prev).toEqual([]);
  });

  it("builds a consistent report", () => {
    const report = reportFromLedger("simply", ledger, true);
    expect(report.periods.month.square).toBe(19);
    expect(report.periods.month.prevSquare).toBe(19);
    expect(report.daily).toHaveLength(28);
    expect(report.daily[27]).toEqual({ date: "2026-07-19", total: 2 });
    // Categories: 19 days × (0.6 + 0.4) split, rounded once at the end.
    expect(report.categories.month).toEqual([
      { key: "retail", label: "Retail (books)", value: Math.round(19 * 0.6) },
      { key: "cafe", label: "Café", value: Math.round(19 * 0.4) },
    ]);
    const noStripe = reportFromLedger("prologue", ledger, false);
    expect(noStripe.periods.day.stripe).toBeNull();
  });
});

describe("square helpers", () => {
  it("buckets category names by keyword with retail fallback", () => {
    expect(bucketOfCategoryName("Taproom & Wine")).toBe("bar");
    expect(bucketOfCategoryName("Coffee Bar")).toBe("bar"); // "bar" wins — real names go in SQUARE_CATEGORY_MAP
    expect(bucketOfCategoryName("Café Kitchen")).toBe("cafe");
    expect(bucketOfCategoryName("Event tickets")).toBe("events");
    expect(bucketOfCategoryName("Fiction")).toBe("retail");
    expect(bucketOfCategoryName("")).toBe("retail");
  });

  it("computes London day boundaries with BST offset", () => {
    const summer = londonDayRange("2026-07-19");
    expect(summer.startAt).toBe("2026-07-19T00:00:00+01:00");
    expect(summer.endAt).toBe("2026-07-20T00:00:00+01:00");
    const winter = londonDayRange("2026-01-10");
    expect(winter.startAt).toBe("2026-01-10T00:00:00+00:00");
  });
});
