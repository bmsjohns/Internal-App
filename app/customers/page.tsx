"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Customer } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import { Avatar } from "@/components/chips";
import { fetchJson } from "@/lib/fetch-json";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    setError("");
    setCustomers(null);
    fetchJson<{ customers: Customer[] }>("/api/customers")
      .then((d) => setCustomers(d.customers))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load customers"));
  }, []);

  useEffect(() => load(), [load]);

  const filtered = useMemo(() => {
    if (!customers) return [];
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    return customers
      .filter((c) => {
        if (!needle) return true;
        if (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)) return true;
        return `${c.name} ${c.email}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, q]);

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      <PageHeader eyebrow="Both venues" title="Customers" />
      <div className="border-b border-cream-2 px-5 py-4 sm:px-8">
        <div className="relative max-w-105">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-stone" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by phone, email or name"
            className="w-full rounded border border-cream-2 bg-white py-2.5 pl-9 pr-3 text-sm text-ink"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {error ? (
          <div className="p-8 text-coral">Couldn’t load customers: {error} <button onClick={load} className="font-semibold underline">Retry</button></div>
        ) : !customers ? (
          <p className="p-8 text-stone">Loading…</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="eyebrow text-left text-stone">
                <th className="py-3 pl-5 pr-4 font-semibold sm:pl-8">Name</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">Email</th>
                <th className="py-3 pl-4 pr-8 text-right font-semibold">Orders</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-cream-2 bg-white hover:bg-shell/60">
                  <td className="py-3.5 pl-5 pr-4 sm:pl-8">
                    <Link href={`/customers/${c.id}`} className="flex items-center gap-[11px] rounded-sm no-underline focus-visible:outline-2 focus-visible:outline-rust">
                      <Avatar name={c.name} />
                      <span className="font-semibold text-ink">{c.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-charcoal">{c.phone || "—"}</td>
                  <td className="hidden px-4 py-3.5 text-charcoal sm:table-cell">{c.email || "—"}</td>
                  <td className="py-3.5 pl-4 pr-8 text-right tabular-nums text-charcoal">{c.orderIds.length}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-stone">
                    No customers match “{q}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      <div className="border-t border-cream-2 bg-white px-5 py-[11px] text-[12.5px] text-stone sm:px-8">
        {customers ? `${customers.length} customers · new customers are added from the order form` : ""}
      </div>
    </div>
  );
}
