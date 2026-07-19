import { describe, expect, it } from "vitest";
import { exportFilename, exportLocation, uniqueWorksheetName } from "@/lib/export-workbook";

describe("outstanding order exports", () => {
  it("accepts only known venue filters", () => {
    expect(exportLocation("Simply Books")).toBe("Simply Books");
    expect(exportLocation("Prologue")).toBe("Prologue");
    expect(exportLocation("Other")).toBeNull();
  });

  it("includes the export scope in the filename", () => {
    expect(exportFilename("Simply Books", "2026-07-19")).toBe("simply-books-to-order-2026-07-19.xlsx");
    expect(exportFilename(null, "2026-07-19")).toBe("both-venues-to-order-2026-07-19.xlsx");
  });

  it("makes truncated and sanitised worksheet names unique", () => {
    const used = new Set<string>();
    const first = uniqueWorksheetName("A very long supplier name with one ending", used);
    const second = uniqueWorksheetName("A very long supplier name with another ending", used);
    expect(first.length).toBeLessThanOrEqual(31);
    expect(second.length).toBeLessThanOrEqual(31);
    expect(second).not.toBe(first);
  });
});
