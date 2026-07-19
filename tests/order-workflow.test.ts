import { describe, expect, it } from "vitest";
import { orderedSupplierError } from "@/lib/order-workflow";

describe("order workflow", () => {
  it("requires a supplier before an order can be marked ordered", () => {
    expect(orderedSupplierError({ publisher: "" }, { status: "Ordered" })).toMatch(/supplier/i);
  });

  it("accepts an existing or simultaneous supplier assignment", () => {
    expect(orderedSupplierError({ publisher: "Gardners" }, { status: "Ordered" })).toBeNull();
    expect(orderedSupplierError({ publisher: "" }, { status: "Ordered", publisher: "Gardners" })).toBeNull();
  });

  it("does not require a supplier for the in-store branch", () => {
    expect(orderedSupplierError({ publisher: "" }, { status: "In Store" })).toBeNull();
  });
});
