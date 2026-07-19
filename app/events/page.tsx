"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Location, ShowEvent } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";
import { EVENT_STATUSES, eventStatus } from "@/lib/events";
import PageHeader, { btnPrimary } from "@/components/PageHeader";
import EventListTable from "@/components/events/EventListTable";
import EventCalendar from "@/components/events/EventCalendar";
import { useVenue } from "@/components/VenueContext";
import { VENUES } from "@/lib/config";

type View = "list" | "calendar";
type DateScope = "upcoming" | "past";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Before the Event Location migration, our own venues still identify their
// shop clearly. Keep the global venue switch useful without inventing an
// owner for external venues.
const effectiveLocation = (event: ShowEvent): Location | null => {
  if (event.location) return event.location;
  const venueName = event.venueName.toLowerCase();
  if (venueName.includes("simply books")) return "Simply Books";
  if (venueName.includes("prologue")) return "Prologue";
  return null;
};

/**
 * Events list + calendar (§5.1) — two views of the same fetched data with
 * shared filters, same pattern as Pitching's board/list toggle.
 */
export default function EventsPage() {
  const { venue, setVenue } = useVenue();
  const [events, setEvents] = useState<ShowEvent[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [view, setView] = useState<View>("list");
  const [dateScope, setDateScope] = useState<DateScope>("upcoming");
  const [statusKey, setStatusKey] = useState("all");
  const [venueId, setVenueId] = useState("all");
  const [type, setType] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "name" | "venue" | "status">("date");
  const location: "all" | Location = venue === "all" ? "all" : VENUES[venue].label;

  useEffect(() => {
    fetch("/api/events")
      .then((r) => {
        if (r.status === 403) {
          setDenied(true);
          return { events: [] };
        }
        return r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`));
      })
      .then((d) => {
        setEvents(d.events);
        setCanEdit(!!d.canEdit);
      })
      .catch((e) => setError(e.message));
  }, []);

  const venues = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of events ?? []) if (e.venueId && e.venueName) seen.set(e.venueId, e.venueName);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [events]);

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const e of events ?? []) for (const t of e.types) set.add(t);
    return [...set].sort();
  }, [events]);

  const filtered = useMemo(() => {
    const today = todayISO();
    return (events ?? []).filter((e) => {
      const past = !!e.date && e.date < today;
      if (dateScope === "past" ? !past : past) return false;
      if (statusKey !== "all" && eventStatus(e.status).key !== statusKey) return false;
      if (venueId !== "all" && e.venueId !== venueId) return false;
      if (type !== "all" && !e.types.includes(type)) return false;
      if (location !== "all" && effectiveLocation(e) !== location) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "venue") return a.venueName.localeCompare(b.venueName);
      if (sortBy === "status") return eventStatus(a.status).label.localeCompare(eventStatus(b.status).label);
      const dateOrder = (a.date || "9999").localeCompare(b.date || "9999") || a.time.localeCompare(b.time);
      return dateScope === "past" ? -dateOrder : dateOrder;
    });
  }, [events, statusKey, venueId, type, location, sortBy, dateScope]);

  if (denied) {
    return (
      <div className="ob-screen flex min-h-screen flex-col">
        <PageHeader eyebrow="Events" title="Events" />
        <div className="flex flex-col items-center justify-center px-5 py-24 text-center">
          <Image src="/assets/bird-perched.png" alt="" width={120} height={98} className="mb-[18px] h-auto w-[120px] opacity-90" />
          <div className="font-display text-2xl text-ink">The Events module needs access.</div>
          <p className="mt-2 max-w-[380px] text-charcoal">
            Ask Ben if you need in — it&rsquo;s a one-line change in Clerk. If you just need tonight&rsquo;s
            call sheet, use the link the events team shared.
          </p>
        </div>
      </div>
    );
  }

  const segBtn = (active: boolean) =>
    `cursor-pointer rounded-md border px-3.5 py-2 text-[12.5px] font-semibold ${
      active ? "border-rust bg-shell text-rust" : "border-cream-2 bg-white text-charcoal"
    }`;
  const select =
    "cursor-pointer rounded-md border border-cream-2 bg-white px-2.5 py-2 text-[12.5px] font-semibold text-charcoal";

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      <PageHeader
        eyebrow="Events · Phase 2"
        title="Events"
        actions={canEdit ? (
          <Link href="/events/new" className={btnPrimary}>
            + New event
          </Link>
        ) : undefined}
      >
        <p className="mb-0 mt-1.5 max-w-[560px] text-[13.5px] text-charcoal">
          Confirmed and provisional bookings. Assign the team, build the call sheet, track the run of show.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex gap-1" role="tablist" aria-label="View">
            <button role="tab" aria-selected={view === "list"} onClick={() => setView("list")} className={segBtn(view === "list")}>
              List
            </button>
            <button role="tab" aria-selected={view === "calendar"} onClick={() => setView("calendar")} className={segBtn(view === "calendar")}>
              Calendar
            </button>
          </div>
          <div className="flex gap-1" aria-label="Date range">
            <button onClick={() => setDateScope("upcoming")} className={segBtn(dateScope === "upcoming")}>Upcoming</button>
            <button onClick={() => setDateScope("past")} className={segBtn(dateScope === "past")}>Past</button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[{ key: "all", label: "All" }, ...EVENT_STATUSES].map((s) => {
              const active = statusKey === s.key;
              const count = s.key === "all" ? 0 : (events ?? []).filter((e) => eventStatus(e.status).key === s.key).length;
              return (
                <button
                  key={s.key}
                  onClick={() => setStatusKey(s.key)}
                  className={`whitespace-nowrap rounded-full border px-[13px] py-[7px] text-[12.5px] font-semibold ${
                    active ? "border-rust bg-rust text-cream" : "border-cream-2 bg-white text-charcoal"
                  }`}
                >
                  {s.label}
                  {count > 0 && <span className="ml-[5px] tabular-nums opacity-60">{count}</span>}
                </button>
              );
            })}
          </div>
          <select value={venueId} onChange={(e) => setVenueId(e.target.value)} className={select} aria-label="Venue filter">
            <option value="all">All venues</option>
            {venues.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className={select} aria-label="Event type filter">
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={location}
            onChange={(e) => setVenue(e.target.value === "Simply Books" ? "simply" : e.target.value === "Prologue" ? "prologue" : "all")}
            className={select}
            aria-label="Location filter"
          >
            <option value="all">All locations</option>
            {LOCATIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className={select} aria-label="Sort events">
            <option value="date">Sort: date</option>
            <option value="name">Sort: event</option>
            <option value="venue">Sort: venue</option>
            <option value="status">Sort: status</option>
          </select>
        </div>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-auto">
        {error && <p className="px-8 pt-4 text-sm font-semibold text-coral">{error}</p>}
        {!events && !error && <p className="p-8 text-stone">Loading…</p>}
        {events && view === "list" && <EventListTable events={filtered} />}
        {events && view === "calendar" && <EventCalendar events={filtered} />}
      </div>

      <div className="flex justify-between border-t border-cream-2 bg-white px-5 py-[11px] text-[12.5px] text-stone sm:px-8">
        <span>
          {filtered.length} event{filtered.length === 1 ? "" : "s"}
        </span>
        <span className="hidden sm:inline">Airtable · Events base · Events</span>
      </div>
    </div>
  );
}
