"use client";

import { useEffect, useRef, useState } from "react";
import type { Customer } from "@/lib/types";

export type PickedCustomer = { id: string; name: string; phone: string } | null;

// Customer search keyed on phone/email first (names collide — spec §11a.3),
// with inline creation and a duplicate-phone warning before creating.
export default function CustomerPicker({
  value,
  onChange,
}: {
  value: PickedCustomer;
  onChange: (c: PickedCustomer) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", email: "" });
  const [dup, setDup] = useState<Customer | null>(null);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/customers?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setResults(d.customers ?? []));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function createCustomer(allowDuplicatePhone = false) {
    setError("");
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, allowDuplicatePhone }),
    });
    const data = await res.json();
    if (res.status === 409 && data.error === "duplicate-phone") {
      setDup(data.existing);
      return;
    }
    if (!res.ok) {
      setError(data.error ?? "Failed to create customer");
      return;
    }
    onChange({ id: data.customer.id, name: data.customer.name, phone: data.customer.phone });
    setCreating(false);
    setDup(null);
    setDraft({ name: "", phone: "", email: "" });
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-ink/20 bg-shell/50 px-3 py-2 text-sm">
        <span className="font-medium">{value.name}</span>
        {value.phone && <span className="text-ink/60">{value.phone}</span>}
        <button type="button" onClick={() => onChange(null)} className="ml-auto text-rust underline">
          change
        </button>
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      {!creating ? (
        <>
          <input
            type="text"
            placeholder="Search by phone, email or name…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full rounded-md border border-ink/20 px-3 py-2 text-sm"
          />
          {open && (q.trim() || results.length > 0) && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-ink/20 bg-white shadow-lg">
              {results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange({ id: c.id, name: c.name, phone: c.phone });
                    setQ("");
                    setOpen(false);
                  }}
                  className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-shell/60"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-ink/60">{c.phone || c.email || "no contact"}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setDraft((d) => ({ ...d, name: /^[\d\s+]+$/.test(q) ? "" : q, phone: /^[\d\s+]+$/.test(q) ? q : "" }));
                  setOpen(false);
                }}
                className="w-full border-t border-ink/10 px-3 py-2 text-left text-sm font-medium text-rust hover:bg-shell/60"
              >
                + New customer{q.trim() ? ` “${q.trim()}”` : ""}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2 rounded-md border border-blush bg-shell/40 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              autoFocus
              placeholder="Name *"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="rounded-md border border-ink/20 px-3 py-2 text-sm"
            />
            <input
              placeholder="Phone"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              className="rounded-md border border-ink/20 px-3 py-2 text-sm"
            />
            <input
              placeholder="Email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              className="rounded-md border border-ink/20 px-3 py-2 text-sm"
            />
          </div>
          {dup && (
            <div className="rounded-md bg-blush/60 p-2 text-sm text-rust-dark">
              A customer with this phone number already exists:{" "}
              <strong>{dup.name}</strong> ({dup.phone}).{" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  onChange({ id: dup.id, name: dup.name, phone: dup.phone });
                  setCreating(false);
                  setDup(null);
                }}
              >
                Use them
              </button>{" "}
              ·{" "}
              <button type="button" className="underline" onClick={() => createCustomer(true)}>
                Create anyway
              </button>
            </div>
          )}
          {error && <p className="text-sm text-coral">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!draft.name.trim()}
              onClick={() => createCustomer()}
              className="rounded-full bg-rust px-3 py-1.5 text-sm font-semibold text-paper disabled:opacity-40"
            >
              Save customer
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setDup(null);
              }}
              className="text-sm text-ink/60 underline"
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
