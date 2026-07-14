"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Order } from "@/lib/types";
import { canonicalStatus, CANONICAL_STATUSES, relTime, VENUES, venueKeyOf } from "@/lib/config";
import { useVenue } from "@/components/VenueContext";
import PageHeader, { btnGhost, btnPrimary } from "@/components/PageHeader";
import { PaidChip, StatusChip } from "@/components/chips";

const FILTER_KEYS = ["all", "needs-ordering", "ready", "ordered", "in-store", "collected"];

export default function OrdersQueue() {
  const router = useRouter();
  const { venue } = useVenue();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        setOrders(d.orders);
        setFetchedAt(new Date());
      })
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!orders) return [];
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (venue !== "all" && venueKeyOf(o.location) !== venue) return false;
      if (status !== "all" && canonicalStatus(o.status).key !== status) return false;
      if (needle && !`${o.bookTitle} ${o.author} ${o.isbn} ${o.customerName ?? ""}`.toLowerCase().includes(needle))
        return false;
      return true;
    });
  }, [orders, q, status, venue]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders ?? []) {
      const k = canonicalStatus(o.status).key;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [orders]);

  const eyebrow =
    venue === "all" ? "Both venues" : `${VENUES[venue].label} · ${VENUES[venue].short}`;

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      <PageHeader
        eyebrow={eyebrow}
        title="Orders"
        actions={
          <>
            <Link href="/summary" className={btnGhost}>
              End of day
            </Link>
            <Link href="/orders/new" className={btnPrimary}>
              + New order
            </Link>
          </>
        }
      >
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-60 max-w-105 flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-stone" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, author or ISBN"
              className="w-full rounded border border-cream-2 bg-white py-2.5 pl-9 pr-3 text-sm text-ink"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTER_KEYS.map((k) => {
              const active = status === k;
              const label = k === "all" ? "All" : CANONICAL_STATUSES.find((s) => s.key === k)!.label;
              const count = k === "all" ? null : counts.get(k) ?? 0;
              return (
                <button
                  key={k}
                  onClick={() => setStatus(k)}
                  className={`whitespace-nowrap rounded-full border px-[13px] py-[7px] text-[12.5px] font-semibold ${
                    active ? "border-rust bg-rust text-cream" : "border-cream-2 bg-white text-charcoal"
                  }`}
                >
                  {label}
                  {count !== null && count > 0 && <span className="ml-1.5 tabular-nums opacity-60">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-auto">
        {error && <p className="p-8 text-coral">Couldn’t load orders: {error}</p>}
        {!orders && !error && <p className="p-8 text-stone">Loading…</p>}

        {orders && filtered.length > 0 && (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="eyebrow text-left text-stone">
                <th className="sticky top-0 bg-cream py-3 pl-5 pr-4 font-semibold sm:pl-8">Book</th>
                <th className="sticky top-0 hidden bg-cream px-4 py-3 font-semibold md:table-cell">Customer</th>
                <th className="sticky top-0 bg-cream px-4 py-3 font-semibold">Status</th>
                <th className="sticky top-0 hidden bg-cream px-4 py-3 font-semibold sm:table-cell">Paid</th>
                <th className="sticky top-0 hidden bg-cream px-4 py-3 font-semibold lg:table-cell">Delivery</th>
                <th className="sticky top-0 hidden bg-cream py-3 pl-4 pr-8 text-right font-semibold md:table-cell">Added</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => router.push(`/orders/${o.id}`)}
                  className="cursor-pointer border-b border-cream-2 bg-white hover:bg-shell/60"
                >
                  <td
                    className="py-[13px] pl-5 pr-4 sm:pl-8"
                    style={{ borderLeft: `3px solid ${VENUES[venueKeyOf(o.location)].color}` }}
                  >
                    <div className="flex items-center gap-1.5">
                      {o.isPreorder && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 text-coral">
                          <title>Pre-order</title>
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v5l3 2" />
                        </svg>
                      )}
                      <span className="font-semibold text-ink">{o.bookTitle}</span>
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-stone">
                      {o.author}
                      {o.isbn && ` · ${o.isbn}`}
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-[13px] text-charcoal md:table-cell">
                    {o.customerName ?? "—"}
                    {o.customerPhone && <div className="text-xs text-stone">{o.customerPhone}</div>}
                  </td>
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
        )}

        {orders && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center px-5 py-20 text-center">
            <Image src="/assets/bird-perched.png" alt="" width={120} height={98} className="mb-[18px] h-auto w-[120px] opacity-90" />
            <div className="font-display text-2xl text-ink">Nothing matches that.</div>
            <p className="mt-2 max-w-[340px] text-charcoal">
              No orders for this filter. Try a different status, or clear your search.
            </p>
            <button
              onClick={() => {
                setQ("");
                setStatus("all");
              }}
              className="mt-3 cursor-pointer rounded border-[1.5px] border-ink bg-transparent px-4 py-[9px] text-[13px] font-semibold text-ink"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-between border-t border-cream-2 bg-white px-5 py-[11px] text-[12.5px] text-stone sm:px-8">
        <span>
          {filtered.length} order{filtered.length === 1 ? "" : "s"}
          {venue !== "all" && ` · ${VENUES[venue].label}`}
        </span>
        <span>
          Airtable · Customer Orders{fetchedAt && ` · synced ${relTime(fetchedAt.toISOString())}`}
        </span>
      </div>
    </div>
  );
}
