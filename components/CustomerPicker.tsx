"use client";

import { useEffect, useRef, useState } from "react";
import type { Customer } from "@/lib/types";
import { Avatar } from "./chips";

export type PickedCustomer = { id: string; name: string; phone: string } | null;

const inputCls =
  "w-full rounded-md border border-cream-2 bg-white px-[13px] py-[11px] text-[14.5px] text-ink";

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
      <div className="flex items-center gap-3 rounded-md border border-cream-2 bg-white px-[13px] py-2.5 text-sm">
        <Avatar name={value.name} size={30} />
        <div className="flex-1 leading-tight">
          <div className="text-[13.5px] font-semibold text-ink">{value.name}</div>
          {value.phone && <div className="text-xs text-stone">{value.phone}</div>}
        </div>
        <button type="button" onClick={() => onChange(null)} className="cursor-pointer text-[13px] font-semibold text-rust underline">
          change
        </button>
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      {!creating ? (
        <>
          <div className="relative">
            <svg className="absolute left-3 top-[15px] text-stone" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="text"
              placeholder="07… or name / email"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              className={`${inputCls} pl-9`}
            />
          </div>
          {open && q.trim() && (
            <div className="absolute z-10 -mt-px w-full overflow-hidden rounded-b-md border border-cream-2 bg-white shadow-lg">
              {results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange({ id: c.id, name: c.name, phone: c.phone });
                    setQ("");
                    setOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-[11px] border-b border-cream-2 bg-white px-3.5 py-[11px] text-left hover:bg-shell/60"
                >
                  <Avatar name={c.name} size={30} />
                  <div className="flex-1 leading-tight">
                    <div className="text-[13.5px] font-semibold text-ink">{c.name}</div>
                    <div className="text-xs text-stone">
                      {[c.phone, c.email].filter(Boolean).join(" · ") || "no contact"}
                    </div>
                  </div>
                  <span className="text-[11px] text-stone">
                    {c.orderIds.length} order{c.orderIds.length === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  const isPhone = /^[\d\s+]+$/.test(q);
                  setDraft((d) => ({ ...d, name: isPhone ? "" : q.trim(), phone: isPhone ? q.trim() : "" }));
                  setOpen(false);
                }}
                className="flex w-full cursor-pointer items-center gap-[9px] bg-white px-3.5 py-[11px] text-left hover:bg-shell/60"
              >
                <span className="text-rust">＋</span>
                <span className="text-[13.5px] font-semibold text-rust">
                  Create new customer{q.trim() ? ` “${q.trim()}”` : ""}
                </span>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2.5 rounded-md border border-blush bg-shell/40 p-3.5">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <input autoFocus placeholder="Name *" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} />
            <input placeholder="Phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inputCls} />
            <input placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={inputCls} />
          </div>
          {dup && (
            <div className="flex items-start gap-2 rounded-md bg-shell px-3 py-2.5 text-[12.5px] text-rust">
              <span>⚠︎</span>
              <span>
                A customer with this phone already exists: <strong>{dup.name}</strong> ({dup.phone}).{" "}
                <button
                  type="button"
                  className="cursor-pointer font-semibold underline"
                  onClick={() => {
                    onChange({ id: dup.id, name: dup.name, phone: dup.phone });
                    setCreating(false);
                    setDup(null);
                  }}
                >
                  Use them
                </button>{" "}
                ·{" "}
                <button type="button" className="cursor-pointer font-semibold underline" onClick={() => createCustomer(true)}>
                  Create anyway
                </button>
              </span>
            </div>
          )}
          {error && <p className="text-sm text-coral">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!draft.name.trim()}
              onClick={() => createCustomer()}
              className="cursor-pointer rounded border-[1.5px] border-rust bg-rust px-3.5 py-2 text-[13px] font-semibold text-cream disabled:opacity-40"
            >
              Save customer
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setDup(null);
              }}
              className="cursor-pointer text-[13px] text-charcoal underline"
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
