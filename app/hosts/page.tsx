"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Host } from "@/lib/types";
import { initialsOf } from "@/lib/config";
import PageHeader, { btnPrimary } from "@/components/PageHeader";

const feeLabel = (fee: number | null) => (fee === 0 ? "No fee" : fee != null ? `£${fee}` : "—");
const igHandle = (url: string) => {
  if (!url) return "";
  const m = url.match(/instagram\.com\/([^/?]+)/);
  return m ? `@${m[1]}` : url.startsWith("@") ? url : "";
};

export default function HostsPage() {
  const router = useRouter();
  const [hosts, setHosts] = useState<Host[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/hosts")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status === 403 ? "The Events module needs access — ask Ben." : `HTTP ${r.status}`))))
      .then((d) => {
        setHosts(d.hosts);
        setCanEdit(!!d.canEdit);
      })
      .catch((e) => setError(e.message));
  }, []);

  const open = (id: string) => router.push(`/hosts/${id}`);

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      <PageHeader
        eyebrow="Events · Phase 2"
        title="Hosts"
        actions={canEdit ? (
          <Link href="/hosts/new" className={btnPrimary}>
            + New host
          </Link>
        ) : undefined}
      >
        <p className="mb-0 mt-1.5 max-w-[560px] text-[13.5px] text-charcoal">
          Chairs and interviewers we work with — fees, contacts and who looks after them.
        </p>
      </PageHeader>

      <div className="flex-1 overflow-auto">
        {error && <p className="px-8 pt-4 text-sm font-semibold text-coral">{error}</p>}
        {!hosts && !error && <p className="p-8 text-stone">Loading…</p>}

        {hosts && (
          <>
            {/* Desktop table */}
            <table className="hidden w-full border-collapse text-sm md:table">
              <thead>
                <tr className="text-left">
                  {["Host", "Contact", "Standard fee", "Team contact", "Events"].map((h, i) => (
                    <th key={h} className={`eyebrow sticky top-0 bg-cream px-4 py-3 font-semibold text-stone ${i === 0 ? "pl-8" : ""} ${i === 4 ? "pr-8 text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hosts.map((h) => (
                  <tr key={h.id} className="border-b border-cream-2 transition-colors hover:bg-shell/60">
                    <td className="py-3.5 pl-8 pr-4">
                      <Link href={`/hosts/${h.id}`} className="flex items-center gap-2.5 rounded-sm no-underline focus-visible:outline-2 focus-visible:outline-rust">
                        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-shell font-display text-[13px] text-rust">
                          {initialsOf(h.name)}
                        </span>
                        <div>
                          <div className="text-[14.5px] font-semibold">{h.name}</div>
                          {igHandle(h.instagram) && <div className="text-xs text-stone">{igHandle(h.instagram)}</div>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-charcoal">
                      <div>{h.phone || "—"}</div>
                      <div className="text-stone">{h.email}</div>
                    </td>
                    <td className="px-4 py-3.5 font-semibold tabular-nums">{feeLabel(h.fee)}</td>
                    <td className="px-4 py-3.5 text-[12.5px] text-charcoal">{h.teamContacts.map((c) => c.name).join(", ") || "—"}</td>
                    <td className="py-3.5 pl-4 pr-8 text-right tabular-nums text-stone">{h.eventIds.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="flex flex-col gap-2.5 px-4 py-4 md:hidden">
              {hosts.map((h) => (
                <button key={h.id} onClick={() => open(h.id)} className="rounded-lg border border-cream-2 bg-white px-4 py-3.5 text-left">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-shell font-display text-[13px] text-rust">
                      {initialsOf(h.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14.5px] font-semibold">{h.name}</div>
                      <div className="truncate text-xs text-stone">{h.phone || h.email || "—"}</div>
                    </div>
                    <span className="font-semibold tabular-nums">{feeLabel(h.fee)}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
