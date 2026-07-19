"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ShowEvent, ShowEventInput } from "@/lib/types";
import type { EventOperationsPreview } from "@/lib/event-operations";
import { LOCATIONS } from "@/lib/types";
import { EVENT_STATUSES, eventStaffIds, eventStatus } from "@/lib/events";
import { btnDanger, btnGhost, btnPrimary } from "@/components/PageHeader";
import { Chevron, inputCls, labelCls, panelCls, panelHead, selectCls, selectWrap, textareaCls } from "@/components/form";
import { EventStatusChip } from "./chips";
import RunningOrderTab from "./RunningOrderTab";
import StaffingTab from "./StaffingTab";
import {
  EventReadinessStrip,
  EventResultsTab,
  EventStockTab,
  EventTasksTab,
  EventTicketsTab,
  PreviewModeNotice,
} from "./EventOperationsPreview";

export interface EventsMeta {
  me: { id: string; name: string };
  canEdit: boolean;
  staff: { id: string; name: string; staffRole: string }[];
  venues: { id: string; name: string; capacity: string; locations: string[] }[];
  hosts: { id: string; name: string; fee: number | null; phone: string }[];
  eventTypes: string[];
  ageGroups: string[];
  schemaReady: boolean;
  eventLocationReady: boolean;
}

type Tab = "general" | "show" | "tasks" | "tickets" | "running" | "staffing" | "orders" | "results";
type SaveState = "idle" | "saving" | "saved" | "error";

const ic = (p: string, size = 15) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: p }} />
);
const ICON_DOWNLOAD = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>';
const ICON_CLOCK = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';

/**
 * Event detail (§5.2 + design brief §2): one screen, five sub-tabs. Existing
 * events autosave optimistically (per the Phase 2 quality bar — no Save
 * button between you and your edit); new events accumulate a draft and POST
 * on "Create event".
 */
export default function EventEditor({
  initial,
  meta,
  isNew,
  fromPitchRef,
  operations,
}: {
  initial: ShowEvent;
  meta: EventsMeta;
  isNew: boolean;
  fromPitchRef?: string;
  operations?: EventOperationsPreview;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ShowEvent>(initial);
  const [tab, setTab] = useState<Tab>("general");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [operationsPreview, setOperationsPreview] = useState(operations);

  // ----- optimistic autosave (existing events) -----
  const pending = useRef<Partial<ShowEventInput>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const recoveryKey = `backstage-event-draft-${initial.id}`;
  const flush = useCallback((keepalive = false): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const run = async () => {
      while (Object.keys(pending.current).length > 0) {
        const payload = pending.current;
        pending.current = {};
        if (mounted.current) setSaveState("saving");
        try {
          const res = await fetch(`/api/events/${initial.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive,
          });
          if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
          if (mounted.current) {
            setSaveState("saved");
            setError("");
          }
          try { sessionStorage.removeItem(recoveryKey); } catch {}
        } catch (e) {
          // A failed older payload is merged behind any newer field values.
          pending.current = { ...payload, ...pending.current };
          if (mounted.current) {
            setSaveState("error");
            setError(e instanceof Error ? e.message : "Couldn’t save");
          }
          break;
        }
      }
    };
    inFlight.current = run().finally(() => {
      inFlight.current = null;
    });
    return inFlight.current;
  }, [initial.id, recoveryKey]);

  const set = useCallback(
    <K extends keyof ShowEventInput>(key: K, value: ShowEventInput[K]) => {
      setDraft((d) => ({ ...d, [key]: value }));
      if (isNew) return;
      (pending.current as any)[key] = value;
      try { sessionStorage.setItem(recoveryKey, JSON.stringify(pending.current)); } catch {}
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 700);
    },
    [isNew, flush, recoveryKey]
  );
  useEffect(() => {
    mounted.current = true;
    try {
      const recovered = sessionStorage.getItem(recoveryKey);
      if (recovered) {
        const patch = JSON.parse(recovered) as Partial<ShowEventInput>;
        pending.current = patch;
        setDraft((current) => ({ ...current, ...patch }));
        setSaveState("error");
        setError("Unsaved changes were recovered. Retry saving before leaving.");
      }
    } catch {}
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length === 0) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => {
      mounted.current = false;
      window.removeEventListener("beforeunload", warnBeforeUnload);
      if (timer.current) clearTimeout(timer.current);
      // keepalive asks the browser to finish this small PATCH during navigation.
      void flush(true);
    };
  }, [flush, recoveryKey]);

  async function create() {
    if (!draft.name.trim()) {
      setError("Name / author is required");
      setTab("general");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, id: undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const { event } = await res.json();
      router.push(`/events/${event.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t create the event");
      setCreating(false);
    }
  }

  async function remove() {
    if (!(await confirmAction(`Delete “${draft.name}”? This can’t be undone here.`, "Delete event"))) return;
    const res = await fetch(`/api/events/${initial.id}`, { method: "DELETE" });
    if (res.ok) router.push("/events");
    else setError("Couldn’t delete the event");
  }

  // Inline "+ New" creation for venues/hosts (same pattern as customers in Orders).
  const [venues, setVenues] = useState(meta.venues);
  const [hosts, setHosts] = useState(meta.hosts);
  async function quickAdd(kind: "venue" | "host") {
    const name = await promptText(kind === "venue" ? "New venue name" : "New host name", kind === "venue" ? "Add venue" : "Add host");
    if (!name) return;
    const res = await fetch(kind === "venue" ? "/api/venues" : "/api/hosts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      setError(`Couldn’t add the ${kind}`);
      return;
    }
    const data = await res.json();
    if (kind === "venue") {
      const v = data.venue;
      setVenues((vs) => [...vs, { id: v.id, name: v.name, capacity: v.capacity, locations: v.locations }]);
      set("venueId", v.id);
      setDraft((d) => ({ ...d, venueId: v.id, venueName: v.name }));
    } else {
      const h = data.host;
      setHosts((hs) => [...hs, { id: h.id, name: h.name, fee: h.fee, phone: h.phone }]);
      set("hostId", h.id);
      setDraft((d) => ({ ...d, hostId: h.id, hostName: h.name }));
    }
  }

  const staffCount = useMemo(() => eventStaffIds(draft).size, [draft]);
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "general", label: "General" },
    { key: "show", label: "Show details" },
    ...(operationsPreview ? [
      { key: "tasks" as const, label: "Tasks", count: operationsPreview.tasks.filter((task) => task.status !== "done").length },
      { key: "tickets" as const, label: "Tickets", count: operationsPreview.luma.connected ? operationsPreview.luma.approved : undefined },
    ] : []),
    { key: "running", label: "Running order", count: draft.schedule.length },
    { key: "staffing", label: "Staffing", count: staffCount },
    { key: "orders", label: "Book orders" },
    ...(operationsPreview ? [{ key: "results" as const, label: "Results" }] : []),
  ];

  const disabled = !meta.canEdit;
  const previewMeta = meta;
  const numVal = (n: number | null) => (n === null ? "" : String(n));
  const setNum = (key: "bookTicket" | "ticketOnly" | "minOrder") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim();
    set(key, v === "" ? null : Math.max(0, parseInt(v, 10) || 0));
  };

  const saveLabel =
    saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Couldn’t save" : "";

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      {/* header + tab bar share one sticky block so they can never drift apart */}
      <div className="sticky top-[52px] z-10 bg-cream lg:top-0">
      <header className="border-b-[1.5px] border-rust px-4 pb-3.5 pt-4 sm:px-8 sm:pt-[22px]">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/events" className="inline-flex items-center gap-1.5 rounded px-2 py-2 text-[13px] font-semibold text-charcoal hover:bg-ink/5">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Events
          </Link>
          <div className="min-w-[160px] flex-1">
            <div className="eyebrow mb-1 text-rust">
              {isNew ? (fromPitchRef ? "Confirm booking" : "New event") : "Event"}
              {saveLabel && (
                <span className={`ml-2.5 normal-case tracking-normal ${saveState === "error" ? "text-coral" : "text-stone"}`}>{saveLabel}</span>
              )}
            </div>
            <h1 className="m-0 truncate text-[24px] leading-none sm:text-[26px]">{draft.name || "Untitled event"}</h1>
          </div>
          <div className="flex items-center gap-2">
            {isNew ? (
              <button onClick={create} disabled={creating || disabled} className={btnPrimary}>
                {creating ? "Creating…" : "Create event"}
              </button>
            ) : (
              <>
                <Link href={`/events/${initial.id}/print`} className={`${btnGhost} hidden sm:inline-flex`}>
                  {ic(ICON_DOWNLOAD)} Export PDF
                </Link>
                <Link href={`/callsheet/${initial.id}`} className={btnPrimary}>
                  {ic(ICON_CLOCK)} Live mode
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* sub-tab bar — thumb-reachable, scrolls on phones (design brief §2) */}
      <div className="border-b border-cream-2 px-4 sm:px-8">
        <div className="flex gap-6 overflow-x-auto">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-0.5 py-3 text-[13.5px] font-semibold ${
                  active ? "border-rust text-rust" : "border-transparent text-charcoal"
                }`}
              >
                {t.label}
                {!!t.count && (
                  <span className={`rounded-full px-[7px] py-px text-[11px] tabular-nums ${active ? "bg-shell text-rust" : "bg-cream-2 text-stone"}`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      </div>

      <div className="w-full max-w-[1180px] px-4 pb-14 pt-[76px] sm:px-8 lg:pt-6">
        {operationsPreview && (
          <div className="mb-5 flex flex-col gap-3">
            <PreviewModeNotice luma={operationsPreview.luma} />
            <EventReadinessStrip operations={operationsPreview} />
          </div>
        )}
        {!meta.canEdit && (
          <div className="mb-4 rounded-lg border border-cream-2 bg-white px-4 py-3 text-[13px] text-charcoal">
            Read-only access — ask an Events editor if this record needs changing.
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-blush bg-shell px-4 py-3 text-[13px] font-semibold text-rust">
            <span>{error}</span>
            {saveState === "error" && (
              <button onClick={() => void flush()} className="cursor-pointer rounded border border-rust px-2.5 py-1 text-xs font-semibold text-rust">
                Retry
              </button>
            )}
          </div>
        )}

        {fromPitchRef && isNew && (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-blush bg-shell px-4 py-3 text-[13px] text-rust">
            {ic('<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>', 16)}
            <div>
              Converted from pitch <strong>{fromPitchRef}</strong> — author, title, ISBN, location, and publisher/imprint details carried
              over. Fill in the date, venue and team to confirm the booking.
            </div>
          </div>
        )}

        {/* ============ GENERAL ============ */}
        {tab === "general" && (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
            <div className="flex flex-col gap-5">
              <section className={panelCls}>
                <span className={panelHead}>Event</span>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelCls} htmlFor="ev-name">Name / author</label>
                    <input id="ev-name" value={draft.name} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder="e.g. Marian Keyes" disabled={disabled} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls} htmlFor="ev-lead">Lead title</label>
                    <input id="ev-lead" value={draft.leadTitle} onChange={(e) => set("leadTitle", e.target.value)} className={inputCls} placeholder="Book being featured" disabled={disabled} />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="ev-isbn">ISBN</label>
                    <input id="ev-isbn" value={draft.isbn} onChange={(e) => set("isbn", e.target.value)} className={`${inputCls} font-mono`} placeholder="978…" disabled={disabled || !meta.schemaReady} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls} htmlFor="ev-date">Date</label>
                      <input id="ev-date" type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} className={inputCls} disabled={disabled} />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="ev-time">Time</label>
                      <input id="ev-time" type="time" value={draft.time} onChange={(e) => set("time", e.target.value)} className={inputCls} disabled={disabled} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="ev-venue">Venue</label>
                    <div className="flex gap-2">
                      <div className={`${selectWrap} flex-1`}>
                        <select id="ev-venue" value={draft.venueId ?? ""} onChange={(e) => set("venueId", e.target.value || null)} className={selectCls} disabled={disabled}>
                          <option value="">Choose venue…</option>
                          {venues.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                        <Chevron />
                      </div>
                      {!disabled && (
                        <button onClick={() => quickAdd("venue")} className="shrink-0 cursor-pointer rounded-md border border-dashed border-cream-2 bg-white px-3 text-[12.5px] font-semibold text-rust">
                          + New
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="ev-host">Host / chair</label>
                    <div className="flex gap-2">
                      <div className={`${selectWrap} flex-1`}>
                        <select id="ev-host" value={draft.hostId ?? ""} onChange={(e) => set("hostId", e.target.value || null)} className={selectCls} disabled={disabled}>
                          <option value="">Choose host…</option>
                          {hosts.map((h) => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </select>
                        <Chevron />
                      </div>
                      {!disabled && (
                        <button onClick={() => quickAdd("host")} className="shrink-0 cursor-pointer rounded-md border border-dashed border-cream-2 bg-white px-3 text-[12.5px] font-semibold text-rust">
                          + New
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="ev-location">Location</label>
                    <div className={selectWrap}>
                      <select
                        id="ev-location"
                        value={draft.location ?? ""}
                        onChange={(e) => set("location", (e.target.value || null) as ShowEventInput["location"])}
                        className={selectCls}
                        disabled={disabled || !meta.eventLocationReady}
                      >
                        <option value="">Choose shop…</option>
                        {LOCATIONS.map((location) => <option key={location} value={location}>{location}</option>)}
                      </select>
                      <Chevron />
                    </div>
                    {!meta.eventLocationReady && <p className="mb-0 mt-1.5 text-xs text-stone">Available after the Event Location migration.</p>}
                  </div>
                </div>
              </section>
              <section className={panelCls}>
                <span className={panelHead}>Notes</span>
                <textarea value={draft.notes} onChange={(e) => set("notes", e.target.value)} className={textareaCls} placeholder="Anything the team should know…" disabled={disabled} />
              </section>
            </div>

            <div className="flex flex-col gap-4">
              <div className={panelCls}>
                <span className={panelHead}>Status</span>
                {meta.schemaReady ? (
                  <div className={selectWrap}>
                    <select value={eventStatus(draft.status).writeAs} onChange={(e) => set("status", e.target.value)} className={selectCls} disabled={disabled} aria-label="Status">
                      {EVENT_STATUSES.map((s) => (
                        <option key={s.key} value={s.writeAs}>{s.label}</option>
                      ))}
                    </select>
                    <Chevron />
                  </div>
                ) : (
                  <EventStatusChip raw={draft.status} />
                )}
                {draft.fromPitchId && (
                  <div className="mt-3 text-xs text-stone">
                    From pitch —{" "}
                    <Link href={`/pitching/${draft.fromPitchId}`} className="font-semibold text-rust">
                      open the pitch
                    </Link>
                  </div>
                )}
                {!meta.schemaReady && (
                  <p className="mb-0 mt-3 text-xs leading-relaxed text-stone">
                    Status editing unlocks with the Phase 2 Airtable migration (awaiting sign-off).
                  </p>
                )}
              </div>
              <div className={panelCls}>
                <span className={panelHead}>Ticketing</span>
                <div className="mb-3.5 grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls} htmlFor="ev-bt">Book + ticket</label>
                    <input id="ev-bt" inputMode="numeric" value={numVal(draft.bookTicket)} onChange={setNum("bookTicket")} className={inputCls} disabled={disabled} />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="ev-to">Ticket only</label>
                    <input id="ev-to" inputMode="numeric" value={numVal(draft.ticketOnly)} onChange={setNum("ticketOnly")} className={inputCls} disabled={disabled} />
                  </div>
                </div>
                <label className={labelCls} htmlFor="ev-min">Minimum order</label>
                <input id="ev-min" inputMode="numeric" value={numVal(draft.minOrder)} onChange={setNum("minOrder")} className={inputCls} disabled={disabled} />
              </div>
              {!isNew && meta.canEdit && (
                <button onClick={remove} className={btnDanger}>
                  Delete event
                </button>
              )}
            </div>
          </div>
        )}

        {/* ============ SHOW DETAILS ============ */}
        {tab === "show" && (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
            <div className="flex flex-col gap-5">
              <section className={panelCls}>
                <span className={panelHead}>Format &amp; audience</span>
                <div className="flex flex-col gap-[18px]">
                  <div>
                    <span className={labelCls}>Event type</span>
                    <div className="flex flex-wrap gap-1.5">
                      {meta.eventTypes.map((t) => {
                        const on = draft.types.includes(t);
                        return (
                          <button
                            key={t}
                            disabled={disabled}
                            onClick={() => set("types", on ? draft.types.filter((x) => x !== t) : [...draft.types, t])}
                            className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] ${
                              on ? "border-rust bg-shell font-semibold text-rust" : "border-cream-2 bg-white text-charcoal"
                            }`}
                          >
                            {t.trim()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <span className={labelCls}>Age group</span>
                    <div className="flex flex-wrap gap-1.5">
                      {meta.ageGroups.map((t) => {
                        const on = draft.ages.includes(t);
                        return (
                          <button
                            key={t}
                            disabled={disabled}
                            onClick={() => set("ages", on ? draft.ages.filter((x) => x !== t) : [...draft.ages, t])}
                            className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] ${
                              on ? "border-rust bg-shell font-semibold text-rust" : "border-cream-2 bg-white text-charcoal"
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="ev-format">Event format &amp; description</label>
                    <textarea id="ev-format" value={draft.format} onChange={(e) => set("format", e.target.value)} className={textareaCls} placeholder="Run of show — doors, format, signing, bar…" disabled={disabled} />
                  </div>
                </div>
              </section>
              <section className={panelCls}>
                <span className={panelHead}>Media &amp; banners</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-dashed border-cream-2 bg-cream px-3.5 py-5 text-center text-stone">
                    <div className="text-[13px] font-semibold text-charcoal">{draft.mediaCount} file{draft.mediaCount === 1 ? "" : "s"}</div>
                    <div className="text-[11.5px]">Poster, headshot, socials — attach in Airtable</div>
                  </div>
                  <label className="flex cursor-pointer flex-col justify-center gap-1.5 rounded-lg border border-cream-2 px-3.5 py-4">
                    <span className="flex items-center justify-between text-[12.5px] text-charcoal">
                      Banners ordered
                      <input type="checkbox" checked={draft.banners} onChange={(e) => set("banners", e.target.checked)} className="h-4 w-4 accent-[#ad3b28]" disabled={disabled} />
                    </span>
                    <span className="text-[11.5px] text-stone">Window + in-store signage for the shop floor.</span>
                  </label>
                </div>
              </section>
            </div>
            <div className="flex flex-col gap-4">
              <div className={panelCls}>
                <span className={panelHead}>Ticketing link</span>
                <label className={labelCls} htmlFor="ev-luma">Luma link</label>
                <input id="ev-luma" value={draft.lumaLink} onChange={(e) => set("lumaLink", e.target.value)} className={inputCls} placeholder="lu.ma/…" disabled={disabled} />
                {draft.lumaLink && (
                  <a href={draft.lumaLink.startsWith("http") ? draft.lumaLink : `https://${draft.lumaLink}`} target="_blank" rel="noreferrer" className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-rust">
                    Open on Luma →
                  </a>
                )}
              </div>
              <div className={panelCls}>
                <span className={panelHead}>Documents</span>
                {!isNew && (
                  <Link href={`/events/${initial.id}/print`} className="mb-2 flex w-full items-center gap-2 rounded-md border border-dashed border-cream-2 bg-cream px-3 py-2.5 text-[13px] text-charcoal">
                    {ic(ICON_DOWNLOAD, 14)} Call sheet (PDF)
                  </Link>
                )}
                <label className="flex cursor-pointer items-center justify-between gap-2 py-1.5 text-[13px] text-charcoal">
                  Call sheet sent
                  <input type="checkbox" checked={draft.callSheetSent} onChange={(e) => set("callSheetSent", e.target.checked)} className="h-4 w-4 accent-[#ad3b28]" disabled={disabled} />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-2 py-1.5 text-[13px] text-charcoal">
                  Sales report sent
                  <input type="checkbox" checked={draft.salesReportSent} onChange={(e) => set("salesReportSent", e.target.checked)} className="h-4 w-4 accent-[#ad3b28]" disabled={disabled} />
                </label>
                {draft.callSheet.length > 0 && (
                  <div className="mt-2 border-t border-cream-2 pt-2.5">
                    {draft.callSheet.map((a) => (
                      <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block truncate py-1 text-[12.5px] font-semibold text-rust">
                        {a.filename}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============ RUNNING ORDER ============ */}
        {tab === "tasks" && operationsPreview && (
          <EventTasksTab
            tasks={operationsPreview.tasks}
            onChange={(tasks) => setOperationsPreview((current) => current ? { ...current, tasks } : current)}
          />
        )}

        {tab === "tickets" && operationsPreview && <EventTicketsTab initial={operationsPreview.luma} backstageEventId={initial.id} canEdit={meta.canEdit} />}

        {/* ============ RUNNING ORDER ============ */}
        {tab === "running" && (
          <RunningOrderTab
            draft={draft}
            meta={previewMeta}
            onChange={(schedule) => set("schedule", schedule)}
            goStaffing={() => setTab("staffing")}
          />
        )}

        {/* ============ STAFFING ============ */}
        {tab === "staffing" && (
          <StaffingTab
            draft={draft}
            meta={previewMeta}
            onChange={(roles) => set("roles", roles)}
            goRunning={() => setTab("running")}
          />
        )}

        {/* ============ BOOK ORDERS ============ */}
        {tab === "orders" && (
          operationsPreview ? (
            <EventStockTab stock={operationsPreview.stock} luma={operationsPreview.luma} />
          ) : (
          <div className="flex max-w-[940px] flex-col gap-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-cream-2 bg-cream px-4 py-3.5 text-[12.5px] text-charcoal">
              <span className="mt-px text-rust">{ic('<path d="M4 21V4"/><path d="M4 4h13l-2.5 4L17 12H4"/>', 15)}</span>
              <span>
                Book orders links this event to its <strong>Stock Order</strong> — the copies ordered in for
                the night. That module arrives in <strong>Phase 3</strong>; below is the summary shape it&rsquo;ll fill.
              </span>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-3">
              <div className={panelCls}>
                <span className={panelHead}>Lead title</span>
                <div className="font-display text-base leading-snug">{draft.leadTitle || "—"}</div>
                {draft.isbn && <div className="mt-1 text-xs tabular-nums text-stone">{draft.isbn}</div>}
              </div>
              <div className={panelCls}>
                <span className={panelHead}>Minimum order</span>
                <div className="font-display text-[26px] tabular-nums">{draft.minOrder ?? "—"}</div>
                <div className="text-xs text-stone">copies</div>
              </div>
              <div className={panelCls}>
                <span className={panelHead}>Stock status</span>
                <div className="mt-1.5 flex items-center gap-2 text-[13px] text-stone">
                  <span className="h-2 w-2 rounded-full bg-cream-2" />
                  Not yet linked
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-cream-2 bg-white opacity-65">
              <div className="eyebrow flex justify-between border-b border-cream-2 px-4 py-3 text-stone">
                <span>Copies ordered in</span>
                <span>Phase 3</span>
              </div>
              <div className="px-4 py-9 text-center text-[13px] text-stone">
                Stock order lines will appear here once Book Orders ships.
              </div>
            </div>
          </div>
          )
        )}

        {tab === "results" && operationsPreview && <EventResultsTab operations={operationsPreview} />}
      </div>
    </div>
  );
}
import { confirmAction, promptText } from "@/lib/dialogs";
