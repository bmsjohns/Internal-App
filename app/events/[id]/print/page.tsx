"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { EventRole, ScheduleItem } from "@/lib/types";
import { PHASES, eventStatus, fmtEventDateLong, fmtEventTime, sortSchedule } from "@/lib/events";

interface CallSheetPayload {
  id: string;
  name: string;
  leadTitle: string;
  date: string;
  time: string;
  status: string;
  venueName: string;
  venueLocation: string;
  venueCapacity: string;
  hostName: string;
  hostPhone: string;
  roles: EventRole[];
  schedule: ScheduleItem[];
  staff: { id: string; name: string; staffRole: string }[];
}

/**
 * Call sheet PDF export (design brief §4): the Running Order tab's content
 * formatted as an on-brand printable document for hosts, venue staff and
 * publishers' reps. "Download PDF" is the browser's print-to-PDF — no
 * server-side PDF stack to maintain for a one-page document.
 */
export default function CallSheetPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<CallSheetPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/events/${id}/callsheet`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 403 ? "No access to this call sheet." : "Couldn’t load the call sheet.");
        setData((await r.json()).callSheet);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const sorted = useMemo(() => (data ? sortSchedule(data.schedule) : []), [data]);

  const leadOf = (leadId: string | null): { name: string; role: string } | null => {
    if (!leadId || !data) return null;
    if (leadId === "host") return { name: data.hostName || "Host / chair", role: "Host / chair" };
    const s = data.staff.find((x) => x.id === leadId);
    return s ? { name: s.name, role: s.staffRole } : null;
  };

  const roster = useMemo(() => {
    if (!data) return [];
    const byPerson = new Map<string, { name: string; staffRole: string; count: number }>();
    for (const r of data.roles)
      for (const s of r.staff) {
        const cur = byPerson.get(s.id) ?? {
          name: s.name,
          staffRole: data.staff.find((x) => x.id === s.id)?.staffRole ?? "",
          count: 0,
        };
        cur.count += 1;
        byPerson.set(s.id, cur);
      }
    return [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const gaps = data?.roles.filter((r) => r.staff.length === 0) ?? [];

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#E4DFD6] px-6 text-center">
        <p className="text-charcoal">{error}</p>
        <Link href={`/events/${id}`} className="mt-2 text-[13px] font-semibold text-rust underline">
          Back to event
        </Link>
      </div>
    );
  }
  if (!data) return <p className="min-h-screen bg-[#E4DFD6] p-8 text-stone">Loading…</p>;

  return (
    <div className="ob-screen flex min-h-screen flex-col items-center bg-[#E4DFD6] print:bg-white">
      {/* toolbar (not printed) */}
      <div className="sticky top-0 z-10 w-full border-b border-cream-2 bg-white print:hidden">
        <div className="mx-auto flex max-w-[794px] items-center gap-3 px-5 py-3">
          <Link href={`/events/${id}`} className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-[13px] font-semibold text-charcoal hover:bg-ink/5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Back to event
          </Link>
          <div className="hidden flex-1 text-[12.5px] text-stone sm:block">Call sheet · PDF export · for hosts, venue &amp; publisher reps</div>
          <button
            onClick={() => window.print()}
            className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded border-[1.5px] border-rust bg-rust px-4 py-2 text-[13px] font-semibold text-cream"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></svg>
            Download PDF
          </button>
        </div>
      </div>

      {/* the document */}
      <div className="my-7 w-full max-w-[794px] bg-white text-ink shadow-[0_6px_30px_rgba(0,0,0,0.12)] print:my-0 print:max-w-none print:shadow-none">
        {/* masthead */}
        <div className="border-b-[3px] border-rust px-7 pb-5 pt-8 sm:px-11">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image src="/assets/p-mark-red.png" alt="" width={26} height={34} className="h-[30px] w-auto object-contain" />
              <span className="font-display text-[21px] leading-none text-rust">Prologue</span>
              <span className="border-l border-cream-2 pl-3 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-stone">Events</span>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone">Call sheet</div>
              <div className="mt-0.5 text-[12.5px] text-charcoal">{eventStatus(data.status).label}</div>
            </div>
          </div>
          <h1 className="m-0 mb-1 text-[32px] leading-[1.05]">{data.name}</h1>
          {data.leadTitle && <div className="text-sm text-stone">{data.leadTitle}</div>}
        </div>

        {/* facts */}
        <div className="grid grid-cols-2 gap-4 border-b border-cream-2 px-7 py-5 sm:grid-cols-4 sm:px-11">
          <div>
            <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-stone">Date</div>
            <div className="text-[13.5px] font-semibold">{fmtEventDateLong(data.date)}</div>
          </div>
          <div>
            <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-stone">Start</div>
            <div className="text-[13.5px] font-semibold">{fmtEventTime(data.time) || "TBC"}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-stone">Venue</div>
            <div className="text-[13.5px] font-semibold">{data.venueName || "—"}</div>
            {data.venueLocation && <div className="text-xs text-stone">{data.venueLocation}</div>}
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-stone">Host / chair</div>
            <div className="text-[13.5px] font-semibold">{data.hostName || "—"}</div>
            {data.hostPhone && <div className="text-xs text-stone">{data.hostPhone}</div>}
          </div>
          {data.venueCapacity && (
            <div>
              <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-stone">Capacity</div>
              <div className="text-[13.5px] font-semibold tabular-nums">{data.venueCapacity}</div>
            </div>
          )}
        </div>

        {/* run of show */}
        <div className="px-7 pb-2 pt-6 sm:px-11">
          <div className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.16em] text-rust">Run of show</div>
          {sorted.length === 0 && <p className="text-[12.5px] text-stone">Nothing scheduled yet.</p>}
          {PHASES.map((ph) => {
            const items = sorted.filter((s) => s.phase === ph.key);
            if (items.length === 0) return null;
            const window =
              items.length === 1
                ? fmtEventTime(items[0].time)
                : `${fmtEventTime(items[0].time)}–${fmtEventTime(items[items.length - 1].time)}`;
            return (
              <div key={ph.key} className="mb-5 break-inside-avoid">
                <div className="mb-0.5 flex items-baseline justify-between border-b-[1.5px] border-ink pb-1">
                  <span className="font-display text-base">{ph.label}</span>
                  <span className="text-xs font-semibold tabular-nums text-stone">{window}</span>
                </div>
                {items.map((it) => {
                  const lead = leadOf(it.leadId);
                  return (
                    <div key={it.id} className="flex gap-4 border-b border-cream-2 px-0.5 py-2">
                      <div className="w-[60px] shrink-0 text-[13.5px] font-bold tabular-nums">{fmtEventTime(it.time)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold">{it.title}</div>
                        {it.note && <div className="text-xs leading-snug text-stone">{it.note}</div>}
                      </div>
                      <div className="w-[140px] shrink-0 text-right">
                        {lead ? (
                          <>
                            <div className="text-[13px] font-semibold">{lead.name}</div>
                            <div className="text-[11px] text-stone">{lead.role}</div>
                          </>
                        ) : (
                          <span className="text-[12.5px] text-stone">Unassigned</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* the team */}
        {roster.length > 0 && (
          <div className="break-inside-avoid px-7 pb-5 pt-1 sm:px-11">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-rust">The team</div>
            <div className="grid grid-cols-1 gap-x-7 gap-y-0 sm:grid-cols-2">
              {roster.map((p) => (
                <div key={p.name} className="flex justify-between gap-3 border-b border-cream-2 py-1.5">
                  <div>
                    <span className="text-[13px] font-semibold">{p.name}</span>{" "}
                    {p.staffRole && <span className="text-[11.5px] text-stone">{p.staffRole}</span>}
                  </div>
                  <div className="text-right text-[11.5px] tabular-nums text-charcoal">
                    {p.count} role{p.count === 1 ? "" : "s"}
                  </div>
                </div>
              ))}
            </div>
            {gaps.length > 0 && (
              <div className="mt-3 text-xs text-[#8a6420]">
                <strong>To fill:</strong> {gaps.map((g) => `${PHASES.find((p) => p.key === g.phase)?.label} · ${g.name}`).join("; ")}
              </div>
            )}
          </div>
        )}

        {/* footer */}
        <div className="flex items-center justify-between border-t border-cream-2 px-7 pb-8 pt-4 sm:px-11">
          <div className="max-w-[420px] text-[11px] leading-relaxed text-stone">
            Prologue · Backstage — generated for this event. Questions on the day: call the host or the
            events lead.
          </div>
          <Image src="/assets/bird-perched.png" alt="" width={54} height={44} className="h-11 w-auto object-contain opacity-90" />
        </div>
      </div>
    </div>
  );
}
