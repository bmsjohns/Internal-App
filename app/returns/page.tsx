"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ReturnRequest } from "@/lib/types";
import {
  estimatedCredit,
  isReturnOverdue,
  outstandingCsv,
  returnStatusMeta,
  returnUnits,
  routeLabel,
  statusIndex,
  waitingDays,
} from "@/lib/returns";
import { money } from "@/lib/clubs";
import { useVenue } from "@/components/VenueContext";
import { useReturnsData } from "@/components/clubs/data";
import { ModuleHeader, useAccent, venueColor } from "@/components/clubs/ui";
import { GhostButton, OriginPill, ReturnStatusPill } from "@/components/returns/ui";

// Outstanding returns — the "what are we waiting on" checklist (spec:
// Reporting view). Everything past staging, filterable by status / origin /
// route, sortable, searchable, exportable. Overdue chases flash red: an RA
// that's been quiet too long, or a shipped parcel with no credit note.

type SortKey = "code" | "location" | "publisher" | "route" | "origin" | "status" | "waiting" | "credit";

const STATUS_CHIPS: { key: string; label: string }[] = [
  { key: "awaiting", label: "Awaiting" },
  { key: "approved", label: "Approved" },
  { key: "shipped", label: "Shipped" },
  { key: "credit", label: "Closed" },
];

export default function OutstandingReturnsPage() {
  const router = useRouter();
  const { venue } = useVenue();
  const { accent, accentSoft } = useAccent();
  const { data, error } = useReturnsData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const [route, setRoute] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("waiting");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const pubOf = (id: string | null) => data?.publishers.find((p) => p.id === id);

  const visible = useMemo(() => {
    if (!data) return [];
    return data.returns.filter(
      (r) =>
        r.status !== "requested" &&
        (venue === "all" || r.location === (venue === "simply" ? "Simply Books" : "Prologue"))
    );
  }, [data, venue]);

  const rows = useMemo(() => {
    let out = visible;
    if (status) out = out.filter((r) => r.status === status);
    if (origin) out = out.filter((r) => r.origin === origin);
    if (route) out = out.filter((r) => r.route === route);
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((r) =>
        [r.code, pubOf(r.publisherId)?.name ?? "", r.raNumber, ...r.lines.flatMap((l) => [l.title, l.isbn])]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    const val = (r: ReturnRequest): string | number => {
      switch (sort) {
        case "code": return r.code;
        case "location": return r.location;
        case "publisher": return pubOf(r.publisherId)?.name ?? "";
        case "route": return r.route;
        case "origin": return r.origin;
        case "status": return statusIndex(r.status);
        case "waiting": return waitingDays(r);
        case "credit": return estimatedCredit(r, pubOf(r.publisherId));
      }
    };
    const d = dir === "asc" ? 1 : -1;
    return [...out].sort((a, b) => {
      let x = val(a), y = val(b);
      if (typeof x === "string") { x = x.toLowerCase(); y = String(y).toLowerCase(); }
      return x < y ? -d : x > y ? d : 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, status, origin, route, search, sort, dir, data]);

  const onSort = (key: SortKey) => {
    if (sort === key) setDir(dir === "asc" ? "desc" : "asc");
    else { setSort(key); setDir("asc"); }
  };

  const chip = (active: boolean) =>
    `inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-[7px] text-[12.5px] font-semibold ${
      active ? "text-white" : "bg-white text-charcoal"
    }`;
  const chipStyle = (active: boolean) =>
    active ? { background: accent, borderColor: accent } : { borderColor: "var(--color-cream-2)" };

  const applied: { label: string; clear: () => void }[] = [];
  if (status) applied.push({ label: returnStatusMeta(status as ReturnRequest["status"]).label, clear: () => setStatus(null) });
  if (origin) applied.push({ label: origin === "event" ? "Event" : "General stock", clear: () => setOrigin(null) });
  if (route) applied.push({ label: routeLabel(route as ReturnRequest["route"]), clear: () => setRoute(null) });

  const exportCsv = () => {
    const text = outstandingCsv(rows, data?.publishers ?? []);
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "outstanding-returns.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalCredit = rows.reduce((s, r) => s + estimatedCredit(r, pubOf(r.publisherId)), 0);

  const th = (key: SortKey, label: string, right = false) => (
    <th
      onClick={() => onSort(key)}
      className={`eyebrow cursor-pointer select-none px-3.5 py-3 font-semibold text-stone hover:text-ink ${right ? "text-right" : "text-left"}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: sort === key ? 1 : 0.35 }}>
          {sort === key ? (dir === "asc" ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />) : <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />}
        </svg>
      </span>
    </th>
  );

  const waitingCell = (r: ReturnRequest) => {
    const over = isReturnOverdue(r);
    const wd = waitingDays(r);
    return (
      <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${over ? "text-[#B23A2A]" : "text-charcoal"}`}>
        {r.status === "credit" ? "—" : `${wd}d`}
        {over && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3.5l9 16.5H3z" />
            <path d="M12 10v4M12 16.5v.5" />
          </svg>
        )}
      </span>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <ModuleHeader
        eyebrow="Returns · outstanding"
        title="Outstanding returns"
        subtitle="Everything not yet credit-confirmed — what we're waiting on and how long it's been. Overdue chases are flagged in red."
        actions={
          <GhostButton onClick={exportCsv}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
            </svg>
            Export CSV
          </GhostButton>
        }
      >
        <div className="flex flex-wrap items-center gap-3 pb-4">
          <div className="relative min-w-[220px] max-w-[380px] flex-1">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, ISBN, publisher, RA number…"
              aria-label="Search returns by title, ISBN, publisher or RA number"
              className="w-full rounded-md border border-cream-2 bg-white py-2.5 pl-9 pr-3 text-sm text-ink"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_CHIPS.map((c) => (
              <button key={c.key} onClick={() => setStatus(status === c.key ? null : c.key)} className={chip(status === c.key)} style={chipStyle(status === c.key)}>
                {c.label}
                <span className="tabular-nums opacity-60">{visible.filter((r) => r.status === c.key).length}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {[["general", "General"], ["event", "Event"]].map(([k, l]) => (
              <button key={k} onClick={() => setOrigin(origin === k ? null : k)} className={chip(origin === k)} style={chipStyle(origin === k)}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {[["direct", "Direct"], ["gardners", "Gardners"]].map(([k, l]) => (
              <button key={k} onClick={() => setRoute(route === k ? null : k)} className={chip(route === k)} style={chipStyle(route === k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {applied.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pb-4">
            <span className="eyebrow text-stone">Applied</span>
            {applied.map((f) => (
              <button
                key={f.label}
                onClick={f.clear}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
                style={{ borderColor: accent, background: accentSoft, color: accent }}
              >
                {f.label}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            ))}
            <button onClick={() => { setStatus(null); setOrigin(null); setRoute(null); }} className="cursor-pointer border-none bg-transparent text-xs text-stone underline">
              Clear all
            </button>
          </div>
        )}
      </ModuleHeader>

      {error && <p className="px-8 py-10 text-sm font-semibold text-rust">{error}</p>}
      {!error && !data && <p className="px-8 py-10 text-sm text-stone">Loading…</p>}

      {data && (
        <div className="flex-1 px-4 pb-5 sm:px-8">
          {rows.length > 0 ? (
            <>
              {/* desktop table */}
              <table className="hidden w-full border-collapse text-sm md:table">
                <thead>
                  <tr>
                    {th("code", "Return")}
                    {th("location", "Location")}
                    {th("publisher", "Publisher")}
                    {th("route", "Route")}
                    {th("origin", "Origin")}
                    {th("status", "Status")}
                    {th("waiting", "Waiting", true)}
                    {th("credit", "Est. credit", true)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/returns/${r.id}`)}
                      className="cursor-pointer bg-white transition-colors hover:bg-shell/50"
                    >
                      <td className="border-t border-cream-2 px-3.5 py-3.5 align-middle">
                        <div className="font-display text-[15px]">{r.code}</div>
                        <div className="text-[11px] text-stone">
                          {r.lines.length} title{r.lines.length === 1 ? "" : "s"} · {returnUnits(r)} units
                        </div>
                      </td>
                      <td className="border-t border-cream-2 px-3.5 py-3.5 align-middle">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: venueColor(r.location) }} />
                          {r.location}
                        </span>
                      </td>
                      <td className="border-t border-cream-2 px-3.5 py-3.5 align-middle">{pubOf(r.publisherId)?.name ?? "—"}</td>
                      <td className="border-t border-cream-2 px-3.5 py-3.5 align-middle">{routeLabel(r.route)}</td>
                      <td className="border-t border-cream-2 px-3.5 py-3.5 align-middle"><OriginPill r={r} /></td>
                      <td className="border-t border-cream-2 px-3.5 py-3.5 align-middle"><ReturnStatusPill status={r.status} /></td>
                      <td className="border-t border-cream-2 px-3.5 py-3.5 text-right align-middle">{waitingCell(r)}</td>
                      <td className="border-t border-cream-2 px-3.5 py-3.5 text-right align-middle font-semibold tabular-nums">
                        {money(estimatedCredit(r, pubOf(r.publisherId)))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* mobile cards */}
              <div className="flex flex-col gap-2.5 pt-2 md:hidden">
                {rows.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => router.push(`/returns/${r.id}`)}
                    className="cursor-pointer rounded-[10px] border border-cream-2 bg-white p-4 text-left"
                    style={{ borderLeft: `3px solid ${returnStatusMeta(r.status).color}` }}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div>
                        <div className="font-display text-[17px]">{r.code}</div>
                        <div className="mt-0.5 text-[12.5px] text-stone">
                          {pubOf(r.publisherId)?.name ?? "—"} · {r.location}
                        </div>
                      </div>
                      <ReturnStatusPill status={r.status} />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[12.5px] text-charcoal">
                      <span>{routeLabel(r.route)} · {r.origin === "event" ? "Event" : "General"}</span>
                      {r.status !== "credit" && waitingCell(r)}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
              <Image src="/assets/bird-perched.png" alt="" width={104} height={104} className="mb-4 h-auto w-[104px] opacity-90" />
              <div className="font-display text-[23px]">Nothing outstanding.</div>
              <p className="mt-1.5 max-w-[340px] text-sm text-charcoal">
                No open returns match this filter. Closed returns show under the Closed chip.
              </p>
            </div>
          )}
        </div>
      )}

      {data && (
        <div className="sticky bottom-0 flex items-center justify-between border-t border-cream-2 bg-white px-4 py-2.5 text-[12.5px] text-stone sm:px-8">
          <span>{rows.length} return{rows.length === 1 ? "" : "s"} shown</span>
          <span>
            Est. credit outstanding · <strong className="tabular-nums text-ink">{money(totalCredit)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
