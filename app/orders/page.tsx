"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Location, Order } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";
import { STATUS_GROUPS } from "@/lib/config";
import { StatusBadge, VenueBadge } from "@/components/badges";

export default function OrdersQueue() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState<Location | "">("");

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setOrders(d.orders))
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!orders) return [];
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (location && o.location !== location) return false;
      if (status && o.status !== status) return false;
      if (needle) {
        const hay = `${o.bookTitle} ${o.author} ${o.customerName ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [orders, q, status, location]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">Orders</h1>
        <Link
          href="/orders/new"
          className="ml-auto rounded-full bg-rust px-4 py-2 text-sm font-semibold text-paper hover:bg-rust-dark"
        >
          + New order
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search title, author, customer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-xs rounded-md border border-ink/20 px-3 py-2 text-sm sm:w-auto"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-ink/20 px-2 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-md border border-ink/20 text-sm">
          <button
            onClick={() => setLocation("")}
            className={`px-3 py-2 ${location === "" ? "bg-rust text-paper" : "bg-white"}`}
          >
            Both venues
          </button>
          {LOCATIONS.map((l) => (
            <button
              key={l}
              onClick={() => setLocation(l)}
              className={`border-l border-ink/20 px-3 py-2 ${location === l ? "bg-rust text-paper" : "bg-white"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-6 text-coral">Couldn’t load orders: {error}</p>}
      {!orders && !error && <p className="mt-6 text-ink/50">Loading…</p>}

      {orders && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-ink/15 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/15 text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="px-3 py-2">Book</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Paid</th>
                <th className="px-3 py-2">Delivery</th>
                <th className="px-3 py-2">Venue</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-ink/10 last:border-0 hover:bg-shell/40">
                  <td className="px-3 py-2">
                    <Link href={`/orders/${o.id}`} className="block">
                      <span className="font-medium text-rust-dark">{o.bookTitle}</span>
                      {o.isPreorder && (
                        <span className="ml-1.5 rounded bg-blush px-1 py-0.5 text-[10px] font-semibold uppercase text-rust-dark">pre-order</span>
                      )}
                      <span className="block text-xs text-ink/60">{o.author}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-ink/80">{o.customerName ?? "—"}</td>
                  <td className="px-3 py-2"><StatusBadge status={o.status} /></td>
                  <td className="px-3 py-2 text-ink/80">{o.paid || "—"}</td>
                  <td className="px-3 py-2 text-ink/80">{o.deliveryMethod || "—"}</td>
                  <td className="px-3 py-2"><VenueBadge location={o.location} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-ink/50">
                    No orders match{q || status || location ? " these filters" : ""}.{" "}
                    <Link href="/orders/new" className="text-rust underline">Add one?</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
