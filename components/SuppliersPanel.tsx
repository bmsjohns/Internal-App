"use client";

import { useCallback, useEffect, useState } from "react";
import type { Supplier } from "@/lib/types";
import { btnGhost, btnPrimary } from "./PageHeader";
import { fetchJson } from "@/lib/fetch-json";

const inputCls = "w-full rounded-md border border-cream-2 bg-white px-3 py-2 text-sm text-ink";

// V3 §3/§4: per-supplier ordering cadence (recorded, not automated) and the
// shop's account number with that supplier (used by the XLSX export).
export default function SuppliersPanel() {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Supplier>>({});
  const [adding, setAdding] = useState({ name: "", cadence: "", accountNumber: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() =>
    fetchJson<{ suppliers: Supplier[] }>("/api/suppliers")
      .then((d) => {
        setSuppliers(d.suppliers);
        setDrafts(Object.fromEntries(d.suppliers.map((s: Supplier) => [s.id, { ...s }])));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load suppliers")), []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRow(id: string) {
    const d = drafts[id];
    setBusy(true);
    setError("");
    const res = await fetch(`/api/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: d.name, cadence: d.cadence, accountNumber: d.accountNumber }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Save failed");
    else await load();
    setBusy(false);
  }

  async function removeRow(id: string, name: string) {
    if (!confirm(`Remove supplier “${name}”? Orders already assigned to it keep the name.`)) return;
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/suppliers/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    }
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
      setAdding({ name: "", cadence: "", accountNumber: "" });
      await load();
    }
    setBusy(false);
  }

  const changed = (s: Supplier) => {
    const d = drafts[s.id];
    return d && (d.name !== s.name || d.cadence !== s.cadence || d.accountNumber !== s.accountNumber);
  };

  return (
    <div>
      <h2 className="m-0 text-[22px]">Suppliers</h2>
      <p className="mb-5 mt-1.5 max-w-[560px] text-sm text-charcoal">
        <strong>Cadence</strong> records how often each supplier&rsquo;s orders get sent (nothing is
        automated — it guides the To&nbsp;Order page). <strong>Account number</strong> is the shop&rsquo;s
        account with that supplier, printed on the XLSX export.
      </p>

      {error && <p className="mb-3 text-sm font-semibold text-coral">{error}</p>}
      {!suppliers && <p className="text-stone">Loading…</p>}

      <div className="flex flex-col gap-2.5">
        {(suppliers ?? []).map((s) => {
          const d = drafts[s.id] ?? s;
          const set = (patch: Partial<Supplier>) =>
            setDrafts((x) => ({ ...x, [s.id]: { ...d, ...patch } }));
          return (
            <div key={s.id} className="grid grid-cols-1 items-center gap-2.5 rounded-lg border border-cream-2 bg-white p-3.5 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
              <input value={d.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} aria-label="Supplier name" />
              <input value={d.cadence} onChange={(e) => set({ cadence: e.target.value })} placeholder="Cadence — e.g. Same day" className={inputCls} aria-label="Cadence" />
              <input value={d.accountNumber} onChange={(e) => set({ accountNumber: e.target.value })} placeholder="Account number" className={`${inputCls} font-mono`} aria-label="Account number" />
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
        <div className="grid grid-cols-1 items-center gap-2.5 rounded-lg border border-dashed border-stone/50 bg-white p-3.5 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
          <input value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} placeholder="Name *" className={inputCls} />
          <input value={adding.cadence} onChange={(e) => setAdding({ ...adding, cadence: e.target.value })} placeholder="Cadence" className={inputCls} />
          <input value={adding.accountNumber} onChange={(e) => setAdding({ ...adding, accountNumber: e.target.value })} placeholder="Account number" className={`${inputCls} font-mono`} />
          <button onClick={add} disabled={busy || !adding.name.trim()} className={btnPrimary}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
