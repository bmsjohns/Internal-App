"use client";

import Link from "next/link";
import type { Order } from "@/lib/types";
import { relTime, VENUES, venueKeyOf } from "@/lib/config";
import { PaidChip, StatusChip } from "./chips";

/** The queue table, shared between the Orders queue and customer profiles. */
export default function OrdersTable({
  orders,
  showCustomer = true,
}: {
  orders: Order[];
  showCustomer?: boolean;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="eyebrow text-left text-stone">
          <th className="sticky top-0 bg-cream py-3 pl-5 pr-4 font-semibold sm:pl-8">Book</th>
          {showCustomer && <th className="sticky top-0 hidden bg-cream px-4 py-3 font-semibold md:table-cell">Customer</th>}
          <th className="sticky top-0 bg-cream px-4 py-3 font-semibold">Status</th>
          <th className="sticky top-0 hidden bg-cream px-4 py-3 font-semibold sm:table-cell">Paid</th>
          <th className="sticky top-0 hidden bg-cream px-4 py-3 font-semibold lg:table-cell">Delivery</th>
          <th className="sticky top-0 hidden bg-cream py-3 pl-4 pr-8 text-right font-semibold md:table-cell">Added</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id} className="border-b border-cream-2 bg-white hover:bg-shell/60">
            <td
              className="py-[13px] pl-5 pr-4 sm:pl-8"
              style={{ borderLeft: `3px solid ${VENUES[venueKeyOf(o.location)].color}` }}
            >
              <Link href={`/orders/${o.id}`} className="block rounded-sm no-underline focus-visible:outline-2 focus-visible:outline-rust">
                <div className="flex items-center gap-1.5">
                  {o.isPreorder && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 text-coral">
                      <title>Pre-order</title>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" />
                    </svg>
                  )}
                  <span className="font-semibold text-ink">{o.bookTitle}</span>
                  {o.quantity > 1 && (
                    <span className="rounded bg-cream-2 px-1.5 py-px text-[11px] font-semibold text-charcoal">×{o.quantity}</span>
                  )}
                </div>
                <div className="mt-0.5 text-[12.5px] text-stone">{o.author}{o.isbn && ` · ${o.isbn}`}</div>
              </Link>
            </td>
            {showCustomer && (
              <td className="hidden whitespace-nowrap px-4 py-[13px] text-charcoal md:table-cell">
                {o.customerName ?? "—"}
                {o.customerPhone && <div className="text-xs text-stone">{o.customerPhone}</div>}
              </td>
            )}
            <td className="px-4 py-[13px]">
              <StatusChip raw={o.status} />
            </td>
            <td className="hidden px-4 py-[13px] sm:table-cell">
              <PaidChip paid={o.paid} />
            </td>
            <td className="hidden px-4 py-[13px] text-charcoal lg:table-cell">{o.deliveryMethod || "—"}</td>
            <td className="hidden whitespace-nowrap py-[13px] pl-4 pr-8 text-right text-[13px] text-stone md:table-cell">
              {relTime(o.orderDate)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
