"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Location, OrderLine, OrderLineSource, Supplier } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";
import PageHeader, { btnGhost, btnPrimary } from "@/components/PageHeader";
import { inputCls, selectCls } from "@/components/form";

type Mode = "batchline" | "sending";
const sourceOptions: ("all" | OrderLineSource)[] = ["all", "Restock", "Customer Order", "Event", "School", "Book Club", "Other"];

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function OrderingHub() {
  const [lines, setLines] = useState<OrderLine[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [restockReady, setRestockReady] = useState(true);
  const [mode, setMode] = useState<Mode>("batchline");
  const [location, setLocation] = useState<"all" | Location>("all");
  const [source, setSource] = useState<"all" | OrderLineSource>("all");
  const [publisher, setPublisher] = useState("all");
  const [status, setStatus] = useState("Not yet ordered");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState({ isbn: "", bookTitle: "", author: "", publisher: "", imprint: "", quantity: 1, location: "Simply Books" as Location });

  const load = () => fetch("/api/order-lines").then(async (r) => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Couldn’t load the Ordering Hub");
    return r.json();
  }).then((data) => {
    setLines(data.lines ?? []);
    setSuppliers(data.suppliers ?? []);
    setRestockReady(data.restockReady !== false);
  }).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const publishers = useMemo(() => [...new Set((lines ?? []).map((line) => line.publisher).filter(Boolean))].sort(), [lines]);
  const visible = useMemo(() => (lines ?? []).filter((line) => {
    const inMode = mode === "batchline" ? line.fulfillmentMethod === "Batchline" : line.fulfillmentMethod !== "Batchline";
    return inMode && (location === "all" || line.location === location) && (source === "all" || line.source === source) &&
      (publisher === "all" || line.publisher === publisher) && (status === "all" || line.status === status);
  }), [lines, mode, location, source, publisher, status]);

  const groups = useMemo(() => {
    const map = new Map<string, OrderLine[]>();
    for (const line of visible) {
      const key = `${line.publisher || "Unassigned"}\u0000${line.location}`;
      map.set(key, [...(map.get(key) ?? []), line]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  async function patch(ids: string[], nextStatus: OrderLine["status"]) {
    setBusy(ids.join("|"));
    setError("");
    const results = await Promise.all(ids.map((id) => fetch(`/api/order-lines/${encodeURIComponent(id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }),
    })));
    if (results.some((r) => !r.ok)) setError("One or more lines could not be updated. Refresh before retrying.");
    await load();
    setBusy("");
  }

  async function lookup() {
    const isbn = adding.isbn.replace(/[^0-9Xx]/g, "");
    if (![10, 13].includes(isbn.length)) return;
    const res = await fetch(`/api/isbn/${isbn}`);
    if (res.ok) {
      const { book } = await res.json();
      setAdding((d) => ({ ...d, isbn, bookTitle: book.title ?? d.bookTitle, author: book.author ?? d.author }));
    }
  }

  async function addRestock() {
    setBusy("add"); setError("");
    const res = await fetch("/api/order-lines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(adding) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Couldn’t add the restock line");
    else {
      setAdding((d) => ({ ...d, isbn: "", bookTitle: "", author: "", imprint: "", quantity: 1 }));
      await load();
    }
    setBusy("");
  }

  const supplierOf = (name: string) => suppliers.find((supplier) => supplier.name === name);
  const accountOf = (supplier: Supplier | undefined, loc: Location) => loc === "Prologue" ? supplier?.accountNumberPrologue : supplier?.accountNumberSimply || supplier?.accountNumber;
  const duplicates = useMemo(() => new Set((lines ?? []).filter((a) => a.status === "Not yet ordered" && (lines ?? []).some((b) => b.id !== a.id && b.status === "Not yet ordered" && !!a.isbn && a.isbn === b.isbn && a.location === b.location)).map((line) => line.id)), [lines]);

  function reviewEmail(group: OrderLine[]) {
    const supplier = supplierOf(group[0].publisher);
    const account = accountOf(supplier, group[0].location) || "[account number needed]";
    const body = [`Hello ${supplier?.repName || ""},`, "", `Please place the following order for ${group[0].location} (account ${account}):`, "",
      ...group.map((line) => `${line.quantity} × ${line.bookTitle}${line.isbn ? ` — ISBN ${line.isbn}` : ""} (${line.source})`), "", "Many thanks"].join("\n");
    window.location.href = `mailto:${encodeURIComponent(supplier?.repEmail ?? "")}?subject=${encodeURIComponent(`Book order — ${group[0].location}`)}&body=${encodeURIComponent(body)}`;
  }

  function exportCsv(group: OrderLine[]) {
    const supplier = supplierOf(group[0].publisher);
    const rows = [["Publisher", "Location", "Account", "Source", "Title", "Author", "ISBN", "Quantity", "Price"],
      ...group.map((line) => [line.publisher, line.location, accountOf(supplier, line.location) ?? "", line.source, line.bookTitle, line.author, line.isbn, line.quantity, line.price ?? ""])];
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${group[0].publisher || "unassigned"}-${group[0].location}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return <div className="ob-screen flex min-h-screen flex-col">
    <PageHeader eyebrow="Orders · shared workflow" title="Ordering Hub" actions={<Link href="/settings" className={btnGhost}>Supplier settings</Link>}>
      <p className="mb-0 mt-2 max-w-[720px] text-sm text-charcoal">Restock and ordinary customer orders stay alongside Batchline. Genuine special orders are grouped for a reviewed email or CSV—nothing sends silently.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => setMode("batchline")} className={mode === "batchline" ? btnPrimary : btnGhost}>Needs actioning in Batchline</button>
        <button onClick={() => setMode("sending")} className={mode === "sending" ? btnPrimary : btnGhost}>Needs sending</button>
      </div>
    </PageHeader>

    <div className="mx-auto w-full max-w-[1120px] flex-1 px-5 pb-12 pt-5 sm:px-8">
      {error && <div className="mb-4 rounded-lg border border-blush bg-shell px-4 py-3 text-sm font-semibold text-rust">{error}</div>}
      {mode === "batchline" && <section className="mb-5 rounded-lg border border-cream-2 bg-white p-4">
        <div className="eyebrow mb-2 text-rust">Add restock line</div>
        {!restockReady && <p className="mb-3 text-sm text-coral">Restock entry unlocks after the Order Lines Airtable migration. Customer Orders remain live.</p>}
        <div className="grid gap-2 md:grid-cols-[1fr_1.5fr_1fr_1fr_90px_140px_auto]">
          <input value={adding.isbn} onChange={(e) => setAdding({ ...adding, isbn: e.target.value })} onBlur={lookup} placeholder="Scan / ISBN" className={`${inputCls} font-mono`} disabled={!restockReady} />
          <input value={adding.bookTitle} onChange={(e) => setAdding({ ...adding, bookTitle: e.target.value })} placeholder="Book title *" className={inputCls} disabled={!restockReady} />
          <input value={adding.author} onChange={(e) => setAdding({ ...adding, author: e.target.value })} placeholder="Author" className={inputCls} disabled={!restockReady} />
          <select value={adding.publisher} onChange={(e) => setAdding({ ...adding, publisher: e.target.value })} className={selectCls} disabled={!restockReady}><option value="">Publisher…</option>{suppliers.map((s) => <option key={s.id}>{s.name}</option>)}</select>
          <input type="number" min={1} value={adding.quantity} onChange={(e) => setAdding({ ...adding, quantity: Math.max(1, Number(e.target.value) || 1) })} className={inputCls} aria-label="Quantity" disabled={!restockReady} />
          <select value={adding.location} onChange={(e) => setAdding({ ...adding, location: e.target.value as Location })} className={selectCls} disabled={!restockReady}>{LOCATIONS.map((value) => <option key={value}>{value}</option>)}</select>
          <button onClick={addRestock} disabled={!restockReady || busy === "add" || !adding.bookTitle.trim()} className={btnPrimary}>Add</button>
        </div>
      </section>}

      <div className="mb-4 flex flex-wrap gap-2">
        <select value={location} onChange={(e) => setLocation(e.target.value as typeof location)} className={selectCls}><option value="all">All locations</option>{LOCATIONS.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className={selectCls}>{sourceOptions.map((value) => <option key={value} value={value}>{value === "all" ? "All sources" : value}</option>)}</select>
        <select value={publisher} onChange={(e) => setPublisher(e.target.value)} className={selectCls}><option value="all">All publishers</option>{publishers.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}><option value="all">All statuses</option><option>Not yet ordered</option><option>Ordered</option><option>Received</option></select>
      </div>

      {!lines && <p className="text-stone">Loading…</p>}
      {lines && groups.length === 0 && <div className="rounded-lg border border-dashed border-cream-2 bg-white px-5 py-12 text-center text-charcoal">Nothing matches this view.</div>}
      <div className="flex flex-col gap-4">{groups.map(([key, group]) => {
        const [publisherName, loc] = key.split("\u0000") as [string, Location];
        const supplier = supplierOf(publisherName);
        const qty = group.reduce((sum, line) => sum + line.quantity, 0);
        const remaining = supplier?.discountThreshold ? Math.max(0, supplier.discountThreshold - qty) : null;
        return <section key={key} className="overflow-hidden rounded-lg border border-cream-2 bg-white">
          <header className="flex flex-wrap items-center gap-3 border-b border-cream-2 bg-shell/50 px-4 py-3">
            <div className="min-w-[220px] flex-1"><div className="font-display text-lg">{publisherName}</div><div className="text-xs text-stone">{loc} · account {accountOf(supplier, loc) || "not configured"} · {qty} copies</div></div>
            {mode === "batchline" && supplier && <div className="max-w-[360px] text-xs text-charcoal">{remaining === 0 ? "Threshold reached — action now." : remaining !== null ? `${remaining} copies short of threshold. ${supplier.thresholdNote}` : supplier.thresholdNote || supplier.cadence}</div>}
            {mode === "sending" && <><button onClick={() => reviewEmail(group)} className={btnGhost}>Review email</button><button onClick={() => exportCsv(group)} className={btnGhost}>CSV</button></>}
            <button onClick={() => patch(group.map((line) => line.id), "Ordered")} disabled={!!busy} className={btnPrimary}>{mode === "batchline" ? "Mark actioned" : "Mark sent"}</button>
          </header>
          <div>{group.map((line) => <div key={line.id} className="flex flex-wrap items-center gap-3 border-b border-cream-2 px-4 py-3 last:border-0">
            <div className="min-w-[220px] flex-1"><div className="font-semibold">{line.bookTitle}</div><div className="text-xs text-stone">{[line.author, line.isbn, line.imprint].filter(Boolean).join(" · ")}</div></div>
            <span className="rounded-full bg-cream px-2.5 py-1 text-xs font-semibold">{line.source}</span><span className="text-sm font-semibold">×{line.quantity}</span>
            {duplicates.has(line.id) && <span className="rounded-full bg-blush px-2.5 py-1 text-xs font-semibold text-rust">Possible duplicate</span>}
            {line.sourceRef && <Link href={`/orders/${line.sourceRef}`} className="text-xs font-semibold text-rust">Open source</Link>}
          </div>)}</div>
        </section>;
      })}</div>
      <p className="mt-5 text-xs text-stone">Live now: Restock and Customer Orders. Event, School and Book Club sources are modelled and ready to connect when those order flows land.</p>
    </div>
  </div>;
}
