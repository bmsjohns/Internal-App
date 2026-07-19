"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Order, Supplier } from "@/lib/types";
import { canonicalStatus, relTime, VENUES, venueKeyOf } from "@/lib/config";
import { useVenue } from "@/components/VenueContext";
import PageHeader, { btnGhost, btnPrimary } from "@/components/PageHeader";
import { VenueDot } from "@/components/chips";
import { fetchJson } from "@/lib/fetch-json";

// V3 §3: the To Order page — an actionable working queue of everything not
// yet ordered (no daily cutoff; the outstanding queue is always current —
// flagged as a question for Ben in the README). Staff set quantity and
// supplier right here at the point of ordering, then mark rows as ordered.
export default function ToOrderPage() {
  const { venue } = useVenue();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    setOrders(null);
    Promise.all([
      fetchJson<{ orders: Order[] }>("/api/orders"),
      fetchJson<{ suppliers: Supplier[] }>("/api/suppliers"),
    ])
      .then(([o, s]) => {
        setOrders(o.orders);
        setSuppliers(s.suppliers);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load the ordering queue"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(
    () =>
      (orders ?? [])
        .filter((o) => canonicalStatus(o.status).key === "needs-ordering")
        .filter((o) => venue === "all" || venueKeyOf(o.location) === venue)
        .sort((a, b) => (a.orderDate > b.orderDate ? 1 : -1)),
    [orders, venue]
  );

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const { order } = await res.json();
      setOrders((os) => (os ?? []).map((o) => (o.id === id ? { ...o, ...order } : o)));
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Update failed");
    }
    setBusyId("");
  }

  const cadenceOf = (name: string) => suppliers.find((s) => s.name === name)?.cadence;

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      <PageHeader
        eyebrow={venue === "all" ? "Both venues" : VENUES[venue].label}
        title="To order"
        actions={
          <>
            <Link href="/settings" className={btnGhost}>
              Suppliers
            </Link>
            <a
              href={
                venue === "all"
                  ? "/api/export/outstanding"
                  : `/api/export/outstanding?location=${encodeURIComponent(VENUES[venue].label)}`
              }
              className={btnPrimary}
              download
            >
              Export XLSX
            </a>
          </>
        }
      >
        <p className="mb-1 mt-3 max-w-[640px] text-sm text-charcoal">
          Everything still waiting to be placed with a supplier. Set the quantity and supplier here,
          then <strong>mark as ordered</strong> — or export the lot, grouped by supplier with your
          account numbers.
        </p>
      </PageHeader>

      {error && (
        <div className="flex items-center gap-3 px-5 pt-4 font-semibold text-coral sm:px-8">
          <span>{error}</span>
          {!orders && <button onClick={load} className="text-sm underline">Retry</button>}
        </div>
      )}

      <div className="mx-auto w-full max-w-[1080px] flex-1 px-5 pb-12 pt-6 sm:px-8">
        {!orders && <p className="text-stone">Loading…</p>}

        {orders && rows.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <Image src="/assets/bird-delivering-book.png" alt="" width={140} height={100} className="mb-4 h-auto w-[140px] opacity-90" />
            <div className="font-display text-2xl">All caught up.</div>
            <p className="mt-2 text-charcoal">Nothing is waiting to be ordered.</p>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {rows.map((o) => {
            const busy = busyId === o.id;
            const cadence = cadenceOf(o.publisher);
            return (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-cream-2 bg-white px-4 py-3.5"
                style={{ borderLeft: `3px solid ${VENUES[venueKeyOf(o.location)].color}` }}
              >
                <div className="min-w-[220px] flex-1">
                  <Link href={`/orders/${o.id}`} className="font-semibold text-ink no-underline hover:text-rust">
                    {o.bookTitle}
                  </Link>
                  <div className="mt-0.5 text-[12.5px] text-stone">
                    {[o.author, o.isbn].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-stone">
                    <VenueDot location={o.location} size={7} />
                    {o.customerName ?? "No customer"} · added {relTime(o.orderDate)}
                  </div>
                </div>

                {/* quantity adjustor */}
                <div className="flex items-center gap-0.5">
                  <span className="eyebrow mr-1.5 text-stone">Qty</span>
                  <button
                    onClick={() => o.quantity > 1 && patch(o.id, { quantity: o.quantity - 1 })}
                    disabled={busy || o.quantity <= 1}
                    aria-label="Decrease quantity"
                    className="h-8 w-8 cursor-pointer rounded border border-cream-2 bg-white text-base font-semibold text-charcoal hover:border-ink disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums">{o.quantity}</span>
                  <button
                    onClick={() => patch(o.id, { quantity: o.quantity + 1 })}
                    disabled={busy}
                    aria-label="Increase quantity"
                    className="h-8 w-8 cursor-pointer rounded border border-cream-2 bg-white text-base font-semibold text-charcoal hover:border-ink disabled:opacity-40"
                  >
                    +
                  </button>
                </div>

                {/* supplier picker at the point of ordering */}
                <div className="flex flex-col">
                  <select
                    value={o.publisher}
                    onChange={(e) => patch(o.id, { publisher: e.target.value })}
                    disabled={busy}
                    className="cursor-pointer rounded border border-cream-2 bg-white px-2.5 py-2 text-[13px] font-semibold text-charcoal"
                  >
                    <option value="">Supplier…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                    {o.publisher && !suppliers.some((s) => s.name === o.publisher) && (
                      <option value={o.publisher}>{o.publisher}</option>
                    )}
                  </select>
                  <span className="mt-0.5 h-4 text-[11px] text-stone">{cadence ? `sends: ${cadence.toLowerCase()}` : ""}</span>
                </div>

                <button
                  onClick={() => patch(o.id, { status: "Ordered" })}
                  disabled={busy || !o.publisher.trim()}
                  title={!o.publisher.trim() ? "Choose a supplier first" : undefined}
                  className={btnPrimary}
                >
                  {busy ? "…" : "Mark ordered"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-cream-2 bg-white px-5 py-[11px] text-[12.5px] text-stone sm:px-8">
        {rows.length} line{rows.length === 1 ? "" : "s"} to order
        {rows.length > 0 && ` · ${rows.reduce((n, o) => n + o.quantity, 0)} copies`}
      </div>
    </div>
  );
}
