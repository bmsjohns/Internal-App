"use client";

import { useEffect, useState } from "react";
import type { Supplier } from "@/lib/types";
import { btnGhost, btnPrimary } from "./PageHeader";

const inputCls = "w-full rounded-md border border-cream-2 bg-white px-3 py-2 text-sm text-ink";

// V3 §3/§4: per-supplier ordering cadence (recorded, not automated) and the
// shop's account number with that supplier (used by the XLSX export).
export default function SuppliersPanel() {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Supplier>>({});
  const emptySupplier = { name: "", cadence: "", accountNumber: "", accountNumberSimply: "", accountNumberPrologue: "", repName: "", repEmail: "", discountThreshold: null as number | null, thresholdNote: "" };
  const [adding, setAdding] = useState(emptySupplier);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((d) => {
        setSuppliers(d.suppliers ?? []);
        setDrafts(Object.fromEntries((d.suppliers ?? []).map((s: Supplier) => [s.id, { ...s }])));
      });

  useEffect(() => {
    load();
  }, []);

  async function saveRow(id: string) {
    const d = drafts[id];
    setBusy(true);
    setError("");
    const res = await fetch(`/api/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...d, accountNumber: d.accountNumberSimply }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Save failed");
    else await load();
    setBusy(false);
  }

  async function removeRow(id: string, name: string) {
    if (!confirm(`Remove supplier “${name}”? Orders already assigned to it keep the name.`)) return;
    setBusy(true);
    await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    await load();
    setBusy(false);
  }

  async function add() {
    if (!adding.name.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adding),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Add failed");
    else {
      setAdding(emptySupplier);
      await load();
    }
    setBusy(false);
  }

  const changed = (s: Supplier) => {
    const d = drafts[s.id];
    return d && JSON.stringify(d) !== JSON.stringify(s);
  };

  return (
    <div>
      <h2 className="m-0 text-[22px]">Suppliers</h2>
      <p className="mb-5 mt-1.5 max-w-[560px] text-sm text-charcoal">
        <strong>Cadence</strong> records how often each supplier&rsquo;s orders get sent (nothing is
        automated — it guides the Ordering Hub). Account numbers are per location; rep details power reviewed email drafts,
        and thresholds provide batching guidance.
      </p>

      {error && <p className="mb-3 text-sm font-semibold text-coral">{error}</p>}
      {!suppliers && <p className="text-stone">Loading…</p>}

      <div className="flex flex-col gap-2.5">
        {(suppliers ?? []).map((s) => {
          const d = drafts[s.id] ?? s;
          const set = (patch: Partial<Supplier>) =>
            setDrafts((x) => ({ ...x, [s.id]: { ...d, ...patch } }));
          return (
            <div key={s.id} className="grid grid-cols-1 items-center gap-2.5 rounded-lg border border-cream-2 bg-white p-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <input value={d.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} aria-label="Supplier name" />
              <input value={d.cadence} onChange={(e) => set({ cadence: e.target.value })} placeholder="Cadence — e.g. Same day" className={inputCls} aria-label="Cadence" />
              <input value={d.accountNumberSimply} onChange={(e) => set({ accountNumberSimply: e.target.value, accountNumber: e.target.value })} placeholder="Simply Books account" className={`${inputCls} font-mono`} aria-label="Simply Books account number" />
              <input value={d.accountNumberPrologue} onChange={(e) => set({ accountNumberPrologue: e.target.value })} placeholder="Prologue account" className={`${inputCls} font-mono`} aria-label="Prologue account number" />
              <input value={d.repName} onChange={(e) => set({ repName: e.target.value })} placeholder="Rep name" className={inputCls} aria-label="Rep name" />
              <input type="email" value={d.repEmail} onChange={(e) => set({ repEmail: e.target.value })} placeholder="Rep email" className={inputCls} aria-label="Rep email" />
              <input type="number" min={1} value={d.discountThreshold ?? ""} onChange={(e) => set({ discountThreshold: e.target.value ? Math.max(1, Number(e.target.value)) : null })} placeholder="Copy threshold" className={inputCls} aria-label="Discount threshold" />
              <input value={d.thresholdNote} onChange={(e) => set({ thresholdNote: e.target.value })} placeholder="Threshold guidance" className={inputCls} aria-label="Threshold guidance" />
              <div className="flex gap-1.5">
                <button onClick={() => saveRow(s.id)} disabled={busy || !changed(s)} className={btnPrimary}>
                  Save
                </button>
                <button onClick={() => removeRow(s.id, s.name)} disabled={busy} className={btnGhost} aria-label={`Remove ${s.name}`}>
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <div className="eyebrow mb-2 text-stone">Add a supplier</div>
        <div className="grid grid-cols-1 items-center gap-2.5 rounded-lg border border-dashed border-stone/50 bg-white p-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <input value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} placeholder="Name *" className={inputCls} />
          <input value={adding.cadence} onChange={(e) => setAdding({ ...adding, cadence: e.target.value })} placeholder="Cadence" className={inputCls} />
          <input value={adding.accountNumberSimply} onChange={(e) => setAdding({ ...adding, accountNumberSimply: e.target.value, accountNumber: e.target.value })} placeholder="Simply Books account" className={`${inputCls} font-mono`} />
          <input value={adding.accountNumberPrologue} onChange={(e) => setAdding({ ...adding, accountNumberPrologue: e.target.value })} placeholder="Prologue account" className={`${inputCls} font-mono`} />
          <input value={adding.repName} onChange={(e) => setAdding({ ...adding, repName: e.target.value })} placeholder="Rep name" className={inputCls} />
          <input type="email" value={adding.repEmail} onChange={(e) => setAdding({ ...adding, repEmail: e.target.value })} placeholder="Rep email" className={inputCls} />
          <input type="number" min={1} value={adding.discountThreshold ?? ""} onChange={(e) => setAdding({ ...adding, discountThreshold: e.target.value ? Math.max(1, Number(e.target.value)) : null })} placeholder="Copy threshold" className={inputCls} />
          <input value={adding.thresholdNote} onChange={(e) => setAdding({ ...adding, thresholdNote: e.target.value })} placeholder="Threshold guidance" className={inputCls} />
          <button onClick={add} disabled={busy || !adding.name.trim()} className={btnPrimary}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
