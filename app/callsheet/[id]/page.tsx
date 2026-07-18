"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EventRole, ScheduleItem } from "@/lib/types";
import { PHASES, fmtEventDateLong, fmtEventTime, liveState, sortSchedule } from "@/lib/events";
import { initialsOf } from "@/lib/config";

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
  venueNotes: string;
  hostName: string;
  hostPhone: string;
  roles: EventRole[];
  schedule: ScheduleItem[];
  notes: string;
  me: string;
  staff: { id: string; name: string; staffRole: string }[];
}

const ic = (p: string, size = 15) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: p }} />
);
const I_CLOCK = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
const I_PIN = '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>';
const I_PHONE = '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 2z"/>';
const I_WIFI_OFF = '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5.2-2.7M12 20h.01M19 12.5a10 10 0 0 0-2.1-1.6M22 8.8A15 15 0 0 0 12 5c-1.2 0-2.4.14-3.5.4M2 8.8a15 15 0 0 1 3-1.9"/>';

/**
 * Live mode — the day-of call sheet (spec §6, design brief). Standalone,
 * phone-first page for the whole on-the-day team: whole roster, everyone's
 * roles, the run of show, current/next markers from the device clock. Built
 * to survive losing signal: data snapshots to localStorage, the page shell
 * is cached by a service worker, and everything after first load renders
 * without the network.
 */
export default function CallSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<CallSheetPayload | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null); // set when showing an offline copy
  const [error, setError] = useState("");
  const cachePrefix = `ob-callsheet-${id}-`;

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      // Prime this page's shell into the cache so the FIRST load is enough
      // to survive a signal drop (see sw.js).
      .then((reg) => reg.active?.postMessage({ type: "cache-page", url: window.location.href }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/events/${id}/callsheet`)
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          // Never retain or display another session's sensitive offline copy.
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key?.startsWith(cachePrefix)) localStorage.removeItem(key);
          }
          sessionStorage.removeItem("ob-callsheet-viewer");
          throw new Error((await r.json()).error ?? "No access");
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const { callSheet } = await r.json();
        setData(callSheet);
        setCachedAt(null);
        try {
          sessionStorage.setItem("ob-callsheet-viewer", callSheet.me);
          localStorage.setItem(`${cachePrefix}${callSheet.me}`, JSON.stringify({ at: new Date().toISOString(), payload: callSheet }));
        } catch {}
      })
      .catch((e) => {
        // Only a network failure may use a recent cache scoped to the viewer
        // established by this browser tab's last authorized response.
        if (e instanceof TypeError) {
          try {
            const viewer = sessionStorage.getItem("ob-callsheet-viewer");
            const raw = viewer ? localStorage.getItem(`${cachePrefix}${viewer}`) : null;
            if (raw) {
              const { at, payload } = JSON.parse(raw);
              const age = Date.now() - new Date(at).getTime();
              if (age >= 0 && age <= 24 * 60 * 60 * 1000 && payload?.me === viewer) {
                setData(payload);
                setCachedAt(at);
                return;
              }
              if (viewer) localStorage.removeItem(`${cachePrefix}${viewer}`);
            }
          } catch {}
        }
        setError(e instanceof Error ? e.message : "Couldn’t open this call sheet");
      });
  }, [id, cachePrefix]);

  // Live markers move with the clock.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const sorted = useMemo(() => (data ? sortSchedule(data.schedule) : []), [data]);
  const live = data ? liveState(data) : { isLive: false, nowIndex: -1, nextIndex: -1 };
  const nowItem = live.nowIndex >= 0 ? sorted[live.nowIndex] : null;
  const nextItem = live.nextIndex >= 0 ? sorted[live.nextIndex] : null;

  const leadName = (leadId: string | null) => {
    if (!leadId || !data) return null;
    if (leadId === "host") return data.hostName || "Host / chair";
    return data.staff.find((s) => s.id === leadId)?.name ?? null;
  };

  const roster = useMemo(() => {
    if (!data) return [];
    const byPerson = new Map<string, { id: string; name: string; roles: { phase: string; role: string; color: string }[] }>();
    for (const r of data.roles) {
      const meta = PHASES.find((p) => p.key === r.phase)!;
      for (const s of r.staff) {
        if (!byPerson.has(s.id)) byPerson.set(s.id, { id: s.id, name: s.name, roles: [] });
        byPerson.get(s.id)!.roles.push({ phase: meta.label, role: r.name, color: meta.color });
      }
    }
    return [...byPerson.values()].sort(
      (a, b) => (b.id === data.me ? 1 : 0) - (a.id === data.me ? 1 : 0) || a.name.localeCompare(b.name)
    );
  }, [data]);

  if (error && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
        <div className="mb-2 font-display text-xl">Can&rsquo;t open this call sheet</div>
        <p className="max-w-[320px] text-[13.5px] text-charcoal">{error}</p>
        <Link href="/" className="mt-4 text-[13px] font-semibold text-rust underline">
          Back to Order Book
        </Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="bg-rust px-4 py-3 text-cream">
          <div className="mx-auto max-w-[520px] font-display">Live mode</div>
        </div>
        <div className="mx-auto max-w-[520px] px-4 py-5">
          <div className="h-40 animate-pulse rounded-xl bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="ob-screen flex min-h-screen flex-col items-center bg-cream">
      {/* red app bar */}
      <div className="sticky top-0 z-10 w-full bg-rust text-cream">
        <div className="mx-auto flex max-w-[520px] items-center gap-3 px-4 py-3">
          <Link
            href={`/events/${id}`}
            aria-label="Back to event"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-white/15"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </Link>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-display text-base">Live mode</div>
            <div className="truncate text-[11px] opacity-85">{data.name}</div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold">
            {ic(I_WIFI_OFF, 12)} Offline ready
          </span>
        </div>
      </div>

      <div className="w-full max-w-[520px] px-4 pb-14 pt-5">
        {cachedAt && (
          <div className="mb-3.5 rounded-lg border border-cream-2 bg-white px-3.5 py-2.5 text-xs text-charcoal">
            No signal — showing the copy saved{" "}
            {new Date(cachedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. It&rsquo;s all
            still here.
          </div>
        )}

        {/* event facts */}
        <div className="mb-4 rounded-xl border border-cream-2 bg-white px-5 pb-[22px] pt-5">
          <div className="mb-3.5 flex items-start justify-between gap-3">
            <div>
              <div className="eyebrow mb-1 text-rust">{fmtEventDateLong(data.date)}</div>
              <h1 className="m-0 text-[26px] leading-[1.05]">{data.name}</h1>
              {data.leadTitle && <div className="mt-1 text-[13.5px] text-stone">{data.leadTitle}</div>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-cream-2 pt-4">
            <div className="flex items-start gap-2">
              <span className="mt-px shrink-0 text-rust">{ic(I_CLOCK, 15)}</span>
              <div>
                <div className="eyebrow text-stone">Time</div>
                <div className="text-sm font-semibold">{fmtEventTime(data.time) || "TBC"}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-px shrink-0 text-rust">{ic(I_PIN, 15)}</span>
              <div>
                <div className="eyebrow text-stone">Venue</div>
                <div className="text-sm font-semibold leading-tight">{data.venueName || "TBC"}</div>
                {data.venueLocation && <div className="text-xs text-stone">{data.venueLocation}</div>}
              </div>
            </div>
            {data.hostName && (
              <div className="col-span-2 flex items-start gap-2 border-t border-cream-2 pt-3">
                <span className="mt-px shrink-0 text-rust">{ic('<circle cx="12" cy="8" r="4"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/>', 15)}</span>
                <div className="flex-1">
                  <div className="eyebrow text-stone">Host / chair</div>
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="text-sm font-semibold">{data.hostName}</span>
                    {data.hostPhone && (
                      <a
                        href={`tel:${data.hostPhone.replace(/\s/g, "")}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-blush px-2.5 py-1 text-[12.5px] font-semibold text-rust"
                      >
                        {ic(I_PHONE, 12)} {data.hostPhone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* live banner */}
        {live.isLive && nowItem && (
          <div className="mb-4 rounded-xl bg-rust px-4 py-3.5 text-cream">
            <div className="mb-2 flex items-center gap-2">
              <span className="ob-pulse h-2 w-2 rounded-full bg-cream" />
              <span className="text-[10.5px] font-bold uppercase tracking-[0.16em]">
                Live now · {PHASES.find((p) => p.key === nowItem.phase)?.label}
              </span>
            </div>
            <div className="font-display text-[22px] leading-tight">{nowItem.title}</div>
            {nextItem && (
              <div className="mt-1.5 border-t border-white/25 pt-2 text-[12.5px] opacity-90">
                Up next · {fmtEventTime(nextItem.time)} — {nextItem.title}
              </div>
            )}
          </div>
        )}

        {/* run of show */}
        <div className="mb-3 mt-1 flex items-center justify-between px-1">
          <div className="eyebrow text-stone">Run of show</div>
          <div className="text-[11.5px] text-stone">{roster.length} people on</div>
        </div>
        {sorted.length === 0 && (
          <div className="rounded-xl border border-dashed border-cream-2 bg-white px-4 py-6 text-center text-[13px] text-stone">
            No run of show yet — the events team builds it on the event page.
          </div>
        )}
        <div className="flex flex-col gap-3.5">
          {PHASES.map((ph) => {
            const items = sorted.filter((s) => s.phase === ph.key);
            if (items.length === 0) return null;
            const isCurrent = nowItem?.phase === ph.key;
            const window =
              items.length === 1
                ? fmtEventTime(items[0].time)
                : `${fmtEventTime(items[0].time)}–${fmtEventTime(items[items.length - 1].time)}`;
            return (
              <section key={ph.key} className="overflow-hidden rounded-xl border border-cream-2 bg-white">
                <div
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={isCurrent ? { background: `${ph.color}14` } : undefined}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ background: ph.color }} />
                    <div className="leading-tight">
                      <div className="font-display text-base">{ph.label}</div>
                      <div className="text-[11.5px] tabular-nums text-stone">{window}</div>
                    </div>
                  </div>
                  {isCurrent && (
                    <span className="rounded-full border border-rust bg-white px-2.5 py-[3px] text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
                      Now
                    </span>
                  )}
                </div>
                {items.map((it) => {
                  const gi = sorted.indexOf(it);
                  const state = !live.isLive ? "plan" : gi === live.nowIndex ? "now" : gi === live.nextIndex ? "next" : gi < live.nowIndex ? "past" : "up";
                  const name = leadName(it.leadId);
                  const mine = it.leadId === data.me;
                  return (
                    <div
                      key={it.id}
                      className="flex gap-3 border-t border-cream-2 py-3 pl-3.5 pr-4"
                      style={{
                        borderLeft: `3px solid ${state === "now" || state === "next" ? ph.color : "var(--color-cream-2)"}`,
                        background: state === "now" ? `${ph.color}12` : state === "next" ? "var(--color-cream)" : "#fff",
                        opacity: state === "past" ? 0.55 : 1,
                      }}
                    >
                      <div className="w-[52px] shrink-0 font-display text-[15px] tabular-nums" style={{ color: state === "now" ? ph.color : state === "past" ? "var(--color-stone)" : "var(--color-ink)" }}>
                        {fmtEventTime(it.time)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-[7px]">
                          <span className="text-sm font-semibold">{it.title}</span>
                          {state === "now" && (
                            <span className="rounded-full bg-rust px-[7px] py-px text-[9.5px] font-bold uppercase tracking-wider text-cream">Now</span>
                          )}
                          {state === "next" && (
                            <span className="rounded-full border border-rust px-[7px] py-px text-[9.5px] font-bold uppercase tracking-wider text-rust">Next</span>
                          )}
                        </div>
                        {it.note && <div className="mt-0.5 text-xs leading-snug text-stone">{it.note}</div>}
                        {name && (
                          <span
                            className={`mt-[7px] inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-[12.5px] font-semibold ${
                              mine ? "bg-rust text-cream" : "border border-cream-2 bg-cream text-ink"
                            }`}
                          >
                            <span className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[9px] ${mine ? "bg-cream font-bold text-rust" : "bg-rust text-cream"}`}>
                              {initialsOf(name)}
                            </span>
                            {name}
                            {mine && " — you"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>

        {/* the team — whole roster, everyone's roles (spec §6.2) */}
        {roster.length > 0 && (
          <>
            <div className="mb-3 mt-6 px-1">
              <div className="eyebrow text-stone">The team</div>
            </div>
            <div className="overflow-hidden rounded-xl border border-cream-2 bg-white">
              {roster.map((p, i) => {
                const mine = p.id === data.me;
                return (
                  <div key={p.id} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? "border-t border-cream-2" : ""} ${mine ? "bg-shell/50" : ""}`}>
                    <span className={`mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-xs ${mine ? "bg-rust text-cream" : "bg-shell text-rust"}`}>
                      {initialsOf(p.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold">{p.name}</span>
                        {mine && <span className="rounded-full bg-rust px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-cream">You</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.roles.map((r, j) => (
                          <span key={j} className="rounded-full border px-2 py-px text-[11px]" style={{ color: r.color, background: `${r.color}12`, borderColor: `${r.color}30` }}>
                            {r.phase} · {r.role}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {data.notes && (
          <div className="mt-4 rounded-xl border border-cream-2 bg-white px-4 py-3.5">
            <div className="eyebrow mb-1.5 text-stone">Notes</div>
            <p className="m-0 whitespace-pre-wrap text-[13px] leading-relaxed text-charcoal">{data.notes}</p>
          </div>
        )}

        <div className="mt-5 flex items-start gap-2 rounded-[10px] border border-cream-2 bg-white px-3.5 py-3 text-xs text-stone">
          <span className="mt-px shrink-0">{ic(I_WIFI_OFF, 13)}</span>
          <span>
            This page is cached on your device — it keeps working if the signal drops backstage. Load it once
            on venue wifi and you&rsquo;re set for the night.
          </span>
        </div>
      </div>
    </div>
  );
}
