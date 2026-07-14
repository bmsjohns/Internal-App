"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { Order } from "@/lib/types";
import { canonicalStatus, VENUES, venueKeyOf, type VenueKey } from "@/lib/config";
import { useVenue } from "@/components/VenueContext";
import PageHeader, { btnGhost, btnPrimary } from "@/components/PageHeader";

const today = () => new Date().toISOString().slice(0, 10);

type Row = { title: string; author: string; isbn: string; qty: number };

// End-of-day summary (spec §4.5, §11a.5): everything still "Needs ordering"
// from that day's activity, grouped by venue, built for fast transfer into
// the stock system — copy rows or export CSV. Row count is the quantity.
export default function SummaryPage() {
  const { venue } = useVenue();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [date, setDate] = useState(today());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []));
  }, []);

  const groups = useMemo(() => {
    if (!orders) return [];
    const active = orders.filter((o) => {
      if (canonicalStatus(o.status).key !== "needs-ordering") return false;
      if (venue !== "all" && venueKeyOf(o.location) !== venue) return false;
      return o.orderDate.slice(0, 10) === date || (o.lastModified || o.orderDate).slice(0, 10) === date;
    });
    return (Object.keys(VENUES) as VenueKey[])
      .map((k) => {
        const byKey = new Map<string, Row>();
        for (const o of active.filter((x) => venueKeyOf(x.location) === k)) {
          const key = o.isbn || o.bookTitle;
          const row = byKey.get(key);
          if (row) row.qty += 1;
          else byKey.set(key, { title: o.bookTitle, author: o.author, isbn: o.isbn, qty: 1 });
        }
        const rows = [...byKey.values()].sort((a, b) => a.title.localeCompare(b.title));
        return { key: k, venue: VENUES[k].label, color: VENUES[k].color, rows, count: rows.reduce((n, r) => n + r.qty, 0) };
      })
      .filter((g) => g.count > 0);
  }, [orders, date, venue]);

  const allRows = groups.flatMap((g) => g.rows.map((r) => ({ ...r, venue: g.venue })));

  function copy() {
    const tsv = allRows.map((r) => [r.title, r.author, r.isbn, r.qty].join("\t")).join("\n");
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadCsv() {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv =
      "Title,Author,ISBN,Quantity,Venue\n" +
      allRows.map((r) => [esc(r.title), esc(r.author), esc(r.isbn), r.qty, esc(r.venue)].join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `to-order-${date}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      <PageHeader
        compact
        backHref="/orders"
        eyebrow={`${dateLabel} · ${venue === "all" ? "both venues" : VENUES[venue].label}`}
        title="End-of-day ordering list"
        actions={
          <>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded border-[1.5px] border-cream-2 bg-white px-3 py-2 text-[13px] font-semibold text-charcoal"
            />
            <button onClick={copy} disabled={allRows.length === 0} className={btnGhost}>
              {copied ? "Copied ✓" : "Copy list"}
            </button>
            <button onClick={downloadCsv} disabled={allRows.length === 0} className={btnPrimary}>
              Export CSV
            </button>
          </>
        }
      />

      <div className="mx-auto w-full max-w-[920px] flex-1 px-5 pb-12 pt-[26px] sm:px-8">
        <p className="mb-5 max-w-[620px] text-charcoal">
          Everything marked <strong className="text-rust">Needs ordering</strong> that day, grouped by venue —
          ready to key into the stock system. Row count is your quantity.
        </p>

        {!orders && <p className="text-stone">Loading…</p>}

        {orders && groups.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <Image src="/assets/bird-delivering-book.png" alt="" width={140} height={100} className="mb-4 h-auto w-[140px] opacity-90" />
            <div className="font-display text-2xl">All caught up.</div>
            <p className="mt-2 text-charcoal">Nothing left to order for this day.</p>
          </div>
        )}

        {groups.map((g) => (
          <div key={g.key} className="mb-[26px]">
            <div className="mb-2.5 flex items-center gap-[9px]">
              <span className="h-[11px] w-[11px] rounded-full" style={{ background: g.color }} />
              <h3 className="m-0 font-display text-xl">{g.venue}</h3>
              <span className="text-xs text-stone">{g.count} to order</span>
            </div>
            <div className="overflow-hidden rounded-lg border border-cream-2 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="eyebrow bg-cream text-left text-stone">
                      <th className="px-4 py-2.5 font-semibold">Title</th>
                      <th className="px-4 py-2.5 font-semibold">Author</th>
                      <th className="px-4 py-2.5 font-semibold">ISBN</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r, i) => (
                      <tr key={i} className="border-t border-cream-2">
                        <td className="px-4 py-[11px] font-semibold text-ink">{r.title}</td>
                        <td className="px-4 py-[11px] text-charcoal">{r.author}</td>
                        <td className="px-4 py-[11px] font-mono text-[13px] text-stone">{r.isbn || "—"}</td>
                        <td className="px-4 py-[11px] text-right tabular-nums text-ink">{r.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
