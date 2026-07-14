"use client";

import { useEffect, useMemo, useState } from "react";
import type { Location, Order } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";
import { NEEDS_ORDERING_STATUSES } from "@/lib/config";
import { VenueBadge } from "@/components/badges";

const today = () => new Date().toISOString().slice(0, 10);

// End-of-day summary (spec §4.5, §11a.5): in-app list of books that still
// need ordering from that day's activity, built for fast transfer into the
// existing stock system — copy as rows or download CSV.
export default function SummaryPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [date, setDate] = useState(today());
  const [location, setLocation] = useState<Location | "">("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []));
  }, []);

  const rows = useMemo(() => {
    if (!orders) return [];
    const active = orders.filter((o) => {
      if (!NEEDS_ORDERING_STATUSES.includes(o.status)) return false;
      if (location && o.location !== location) return false;
      const touched = (o.lastModified || o.orderDate).slice(0, 10);
      const created = o.orderDate.slice(0, 10);
      return touched === date || created === date;
    });
    // Same book ordered for several customers → one line with quantity.
    const byKey = new Map<string, { title: string; author: string; isbn: string; qty: number; location: Location }>();
    for (const o of active) {
      const key = `${o.isbn || o.bookTitle}|${o.location}`;
      const row = byKey.get(key);
      if (row) row.qty += 1;
      else byKey.set(key, { title: o.bookTitle, author: o.author, isbn: o.isbn, qty: 1, location: o.location });
    }
    return [...byKey.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [orders, date, location]);

  const tsv = rows.map((r) => [r.title, r.author, r.isbn, r.qty].join("\t")).join("\n");

  function copy() {
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadCsv() {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv =
      "Title,Author,ISBN,Quantity\n" +
      rows.map((r) => [esc(r.title), esc(r.author), esc(r.isbn), r.qty].join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `to-order-${date}${location ? `-${location.toLowerCase().replace(" ", "-")}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold">End of day — books to order</h1>
      <p className="mt-1 text-sm text-ink/60">
        Orders added or updated on the chosen day that are still waiting to be ordered
        ({NEEDS_ORDERING_STATUSES.join(", ")}). Copy or export, then re-enter into the stock system.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-ink/20 px-3 py-2 text-sm"
        />
        <div className="flex overflow-hidden rounded-md border border-ink/20 text-sm">
          <button onClick={() => setLocation("")} className={`px-3 py-2 ${location === "" ? "bg-rust text-paper" : "bg-white"}`}>
            Both venues
          </button>
          {LOCATIONS.map((l) => (
            <button key={l} onClick={() => setLocation(l)} className={`border-l border-ink/20 px-3 py-2 ${location === l ? "bg-rust text-paper" : "bg-white"}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={copy}
            disabled={rows.length === 0}
            className="rounded-full bg-rust px-4 py-2 text-sm font-semibold text-paper hover:bg-rust-dark disabled:opacity-40"
          >
            {copied ? "Copied ✓" : "Copy rows"}
          </button>
          <button
            onClick={downloadCsv}
            disabled={rows.length === 0}
            className="rounded-full border border-rust px-4 py-2 text-sm font-semibold text-rust hover:bg-shell disabled:opacity-40"
          >
            Download CSV
          </button>
        </div>
      </div>

      {!orders ? (
        <p className="mt-6 text-ink/50">Loading…</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-ink/15 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/15 text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Author</th>
                <th className="px-3 py-2">ISBN</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Venue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-ink/10 last:border-0">
                  <td className="px-3 py-2 font-medium">{r.title}</td>
                  <td className="px-3 py-2 text-ink/80">{r.author}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink/70">{r.isbn || "—"}</td>
                  <td className="px-3 py-2">{r.qty}</td>
                  <td className="px-3 py-2"><VenueBadge location={r.location} /></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-ink/50">
                    Nothing left to order for this day. 🎉
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
