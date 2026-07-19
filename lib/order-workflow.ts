import { canonicalStatus } from "@/lib/config";
import type { Order } from "@/lib/types";

/**
 * Ordering is one operational action: an order must not leave the actionable
 * queue until the supplier it was placed with is recorded.
 */
export function orderedSupplierError(
  existing: Pick<Order, "publisher">,
  patch: { status?: unknown; publisher?: unknown }
): string | null {
  if (typeof patch.status !== "string" || canonicalStatus(patch.status).key !== "ordered") return null;
  const publisher = typeof patch.publisher === "string" ? patch.publisher : existing.publisher;
  return publisher.trim() ? null : "Choose a supplier before marking this order as ordered";
}
