import type { EventPhase, ScheduleItem, ShowEvent } from "@/lib/types";

// ---------------------------------------------------------------------------
// Events Phase 2 domain model — statuses, phases, option lists, live-state
// helpers. Sibling of lib/pitching.ts (Phase 1) and lib/config.ts (Orders).
// ---------------------------------------------------------------------------

/**
 * Event booking status. The live Events table has NO status field today —
 * this is a proposed new single select (docs/events-phase2-migration.md).
 * Until that migration lands, the Airtable source reports every event as
 * "Confirmed" (they're all past/live bookings) and refuses status writes.
 */
export interface EventStatus {
  key: string;
  label: string;
  color: string;
  writeAs: string;
}

export const EVENT_STATUSES: EventStatus[] = [
  { key: "confirmed", label: "Confirmed", color: "#5F7355", writeAs: "Confirmed" },
  { key: "provisional", label: "Provisional", color: "#B0812F", writeAs: "Provisional" },
  { key: "draft", label: "Draft", color: "#8C857C", writeAs: "Draft" },
  { key: "cancelled", label: "Cancelled", color: "#B8B0A6", writeAs: "Cancelled" },
];

export function eventStatus(raw: string): EventStatus {
  const k = raw.trim().toLowerCase();
  return EVENT_STATUSES.find((s) => s.key === k || s.writeAs.toLowerCase() === k) ?? EVENT_STATUSES[0];
}

/** The three call-sheet phases (spec §6.1 — confirmed set). */
export const PHASES: { key: EventPhase; label: string; hint: string; color: string }[] = [
  { key: "pre", label: "Pre show", hint: "Set-up & arrival", color: "#B0812F" },
  { key: "during", label: "During show", hint: "Doors to close", color: "#AD3B28" },
  { key: "post", label: "Post show", hint: "Signing & pack-down", color: "#5F7355" },
];

export const phaseMeta = (key: EventPhase) => PHASES.find((p) => p.key === key) ?? PHASES[0];

// Real option lists pulled from the live base 16 Jul 2026 (spec §2 said to
// pull these before building — the design file's lists were placeholders).
// "External Selling " keeps its trailing space: that IS the stored option.
export const EVENT_TYPE_OPTIONS = [
  "In-house",
  "External Selling ",
  "Fane",
  "School",
  "Shop Event",
  "Signing",
  "To Categorise",
  "Theatre Event",
  "Launch",
  "Book Club Exclusive",
];

export const AGE_GROUP_OPTIONS = ["KS1", "KS2", "KS3", "KS4", "Year 1", "Year 2", "9-12", "8-12"];

/** Venues.Location multi-select (venue's own area — NOT the Simply/Prologue shop field). */
export const VENUE_LOCATION_OPTIONS = ["Bramhall", "Stockport", "Manchester"];
export const VENUE_STATUS_OPTIONS = ["Todo", "In progress", "Done"];

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function fmtEventTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const ap = h < 12 ? "am" : "pm";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return m ? `${hh}.${String(m).padStart(2, "0")}${ap}` : `${hh}${ap}`;
}

export function fmtEventDate(iso: string): string {
  if (!iso) return "Date TBC";
  return new Date(iso + "T00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function fmtEventDateLong(iso: string): string {
  if (!iso) return "Date TBC";
  return new Date(iso + "T00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Derived staffing / schedule state
// ---------------------------------------------------------------------------

/** "3/9 roles" summary for the list view. */
export function staffingSummary(ev: Pick<ShowEvent, "roles">): { label: string; complete: boolean; total: number; filled: number } {
  const total = ev.roles.length;
  const filled = ev.roles.filter((r) => r.staff.length > 0).length;
  return { label: total ? `${filled}/${total} roles` : "No roles yet", complete: total > 0 && filled === total, total, filled };
}

const timeMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const sortSchedule = (items: ScheduleItem[]) => [...items].sort((a, b) => timeMin(a.time) - timeMin(b.time));

export interface LiveState {
  isLive: boolean;
  nowIndex: number; // index into the sorted schedule, -1 if none started
  nextIndex: number; // -1 if nothing left
}

/**
 * Where are we in the run of show right now? Live from one hour before the
 * first step until one hour after the last (glanceable "now/next" markers,
 * spec/design §3) — outside that window the schedule renders as a plan.
 */
export function liveState(ev: Pick<ShowEvent, "date" | "schedule">, now = new Date()): LiveState {
  const sorted = sortSchedule(ev.schedule);
  const none = { isLive: false, nowIndex: -1, nextIndex: -1 };
  if (!ev.date || sorted.length === 0) return none;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (ev.date !== today) return none;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const first = timeMin(sorted[0].time);
  const last = timeMin(sorted[sorted.length - 1].time);
  if (nowMin < first - 60 || nowMin > last + 60) return none;
  let nowIndex = -1;
  sorted.forEach((it, i) => {
    if (timeMin(it.time) <= nowMin) nowIndex = i;
  });
  const nextIndex = sorted.findIndex((it) => timeMin(it.time) > nowMin);
  return { isLive: true, nowIndex, nextIndex };
}

/** Distinct people assigned anywhere on the event (roles + schedule leads). */
export function eventStaffIds(ev: Pick<ShowEvent, "roles" | "schedule">): Set<string> {
  const ids = new Set<string>();
  for (const r of ev.roles) for (const s of r.staff) ids.add(s.id);
  for (const it of ev.schedule) if (it.leadId && it.leadId !== "host") ids.add(it.leadId);
  return ids;
}
