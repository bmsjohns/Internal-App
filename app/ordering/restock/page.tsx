"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { Location } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";
import { useVenue } from "@/components/VenueContext";
import { post, useHubData } from "@/components/clubs/data";
import { ModuleHeader, Toast, useAccent, venueColor } from "@/components/clubs/ui";

// Restock — Flow D (spec C5): decision-support ONLY. No EPOS/Batchline API
// exists, so this is capture-and-decide: staff scan items on the shop floor
// (phone-first, barcode-scannable), the list groups by supplier with the
// Settings cadence as guidance, and the actual order is placed in Batchline
// — "mark handled" retires the item. No sending, no arrival tracking.
export default function RestockPage() {
  const { venue } = useVenue();
  const { accent, accentSoft } = useAccent();
  const { data, error, refresh } = useHubData();
  const [scan, setScan] = useState("");
  const [title, setTitle] = useState("");
  const [qty, setQty] = useState(1);
  const [loc, setLoc] = useState<Location>("Prologue");
  const [supplier, setSupplier] = useState("Gardners");
  const [looking, setLooking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  // Supplier options: the Settings suppliers list first (it carries the
  // cadence), then hub publishers not already in it.
  const supplierOptions = useMemo(() => {
    const names = new Set<string>();
    const out: string[] = [];
    for (const s of data?.suppliers ?? []) {
      if (!names.has(s.name)) {
        names.add(s.name);
        out.push(s.name);
      }
    }
    for (const p of data?.publishers ?? []) {
      if (!names.has(p.name)) {
        names.add(p.name);
        out.push(p.name);
      }
    }
    return out.length ? out : ["Gardners"];
  }, [data]);

  const cadenceOf = (name: string) =>
    data?.suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase())?.cadence ?? "";

  const lookup = async (raw: string) => {
    const clean = raw.replace(/[^0-9Xx]/g, "");
    if (clean.length !== 13 && clean.length !== 10) return;
    setLooking(true);
    try {
      const res = await fetch(`/api/isbn/${clean}`);
      if (res.ok) {
        const d = await res.json();
        if (d?.book?.title) setTitle(d.book.title);
        if (d?.book?.publisher) {
          const match = supplierOptions.find(
            (n) =>
              n.toLowerCase().includes(String(d.book.publisher).toLowerCase()) ||
              String(d.book.publisher).toLowerCase().includes(n.toLowerCase())
          );
          if (match) setSupplier(match);
        }
      }
    } catch {}
    setLooking(false);
  };

  const add = async () => {
    const isbn = scan.replace(/[^0-9Xx]/g, "");
    const finalTitle = title.trim() || (scan.trim() && !/^[0-9\s]+$/.test(scan) ? scan.trim() : "");
    if (!finalTitle && !isbn) {
      showToast("Scan a barcode or type a title first");
      return;
    }
    setBusy(true);
    try {
      await post("/api/hub/restock", {
        title: finalTitle || `Scanned — ${isbn}`,
        isbn: isbn.length >= 10 ? isbn : "",
        quantity: qty,
        location: loc,
        supplier,
      });
      setScan("");
      setTitle("");
      setQty(1);
      refresh();
      showToast("Added to restock list");
      scanRef.current?.focus();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Add failed");
    } finally {
      setBusy(false);
    }
  };

  const handle = async (id: string) => {
    try {
      await post("/api/hub/restock", { action: "handle", id });
      refresh();
      showToast("Marked handled — ordered in Batchline (logged)");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed");
    }
  };

  const items = useMemo(() => {
    return (data?.restock ?? [])
      .filter((r) => !r.handledAt)
      .filter((r) => venue === "all" || r.location === (venue === "simply" ? "Simply Books" : "Prologue"));
  }, [data, venue]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const r of items) map.set(r.supplier || "Unassigned", [...(map.get(r.supplier || "Unassigned") ?? []), r]);
    return [...map.entries()];
  }, [items]);

  const exportCsv = () => {
    const cell = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const text = [
      "Title,ISBN,Qty,Location,Supplier,By",
      ...items.map((r) => [r.title, r.isbn, r.quantity, r.location, r.supplier, r.by].map(cell).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "restock.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen">
      <ModuleHeader
        eyebrow="Ordering hub · flow D · decision-support"
        title="Restock"
        subtitle="Capture what's running low on the shop floor. The hub doesn't send restock — you place it in Batchline, then mark it handled. No arrival tracking."
      />

      {/* capture bar — built for standing in the shop with a scanner */}
      <div className="border-b border-cream-2 px-4 py-4 sm:px-8" style={{ background: accentSoft }}>
        <div className="flex max-w-[960px] flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: accent }}>
              <path d="M3 5v14M7 5v14M11 5v14M15 5v10M19 5v14" />
            </svg>
            <input
              ref={scanRef}
              value={scan}
              onChange={(e) => {
                setScan(e.target.value);
                lookup(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Scan barcode or type ISBN / title"
              aria-label="Scan barcode or type ISBN or title"
              className="w-full rounded-lg border-[1.5px] bg-white py-3 pl-10 pr-3 text-[15px] text-ink"
              style={{ borderColor: accent }}
            />
          </div>
          <div className="inline-flex items-center overflow-hidden rounded-lg border border-cream-2 bg-white">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="cursor-pointer border-none bg-transparent px-3.5 py-3 text-base">
              –
            </button>
            <span className="min-w-[44px] border-x border-cream-2 py-3 text-center font-semibold tabular-nums">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="cursor-pointer border-none bg-transparent px-3.5 py-3 text-base">
              +
            </button>
          </div>
          <div className="flex gap-1.5">
            {LOCATIONS.map((l) => {
              const active = loc === l;
              const dot = venueColor(l);
              return (
                <button
                  key={l}
                  onClick={() => setLoc(l)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2.5 text-[12.5px] font-semibold"
                  style={
                    active
                      ? { borderColor: dot, background: dot, color: "#fff" }
                      : { borderColor: "var(--color-cream-2)", background: "#fff", color: "var(--color-charcoal)" }
                  }
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: active ? "#fff" : dot }} />
                  {l}
                </button>
              );
            })}
          </div>
          <select
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="rounded-lg border border-cream-2 bg-white px-3 py-3 text-[13px] font-semibold text-charcoal"
          >
            {supplierOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={busy}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] px-4 py-3 text-[13.5px] font-semibold text-white hover:brightness-95 disabled:opacity-50"
            style={{ background: accent, borderColor: accent }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add
          </button>
        </div>
        {(title || looking) && (
          <div className="mt-2 text-[12.5px] text-charcoal">
            {looking ? "Looking up…" : (
              <>
                Adding: <strong>{title}</strong> → {supplier}
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="px-8 py-10 text-sm font-semibold text-rust">{error}</p>}

      <div className="px-4 py-5 sm:px-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[13px] text-stone">
            {items.length} to hand off · grouped by supplier cadence
          </div>
          {items.length > 0 && (
            <button
              onClick={exportCsv}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-[1.5px] border-cream-2 bg-transparent px-3 py-2 text-[12.5px] font-semibold text-charcoal hover:border-ink"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M12 3v12M7 10l5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              Export CSV
            </button>
          )}
        </div>

        {groups.map(([sup, rows]) => (
          <div key={sup} className="mb-5">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="font-display text-[19px]">{sup}</span>
              {cadenceOf(sup) && (
                <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: accent, background: accentSoft }}>
                  {cadenceOf(sup)}
                </span>
              )}
            </div>
            <div className="overflow-hidden rounded-[10px] border border-cream-2 bg-white">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-3 border-t border-cream-2 px-4 py-3 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.title}</div>
                    <div className="text-xs tabular-nums text-stone">
                      {r.isbn || "no ISBN"} · {r.location} · {r.by}
                    </div>
                  </div>
                  <span className="font-semibold tabular-nums text-charcoal">×{r.quantity}</span>
                  <button
                    onClick={() => handle(r.id)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-[1.5px] border-cream-2 bg-transparent px-3 py-1.5 text-[12.5px] font-semibold text-charcoal hover:border-ink"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Mark handled
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {data && items.length === 0 && (
          <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
            <Image src="/assets/bird-reading.png" alt="" width={104} height={104} className="mb-4 h-auto w-[104px] opacity-90" />
            <div className="font-display text-[23px]">Nothing to reorder.</div>
            <p className="mt-1.5 max-w-[320px] text-sm text-charcoal">
              Scan an item as you spot it running low. Fast, standing-up-in-the-shop fast.
            </p>
          </div>
        )}
      </div>
      {toast && <Toast text={toast} />}
    </div>
  );
}
