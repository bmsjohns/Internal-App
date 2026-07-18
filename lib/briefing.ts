import type { VenueKey } from "@/lib/config";

// ---------------------------------------------------------------------------
// Daily Briefing domain model — spec (daily-briefing-spec.md) + the Claude
// Design file "Daily Briefing.dc.html", which is the visual source of truth
// and goes beyond the spec (urgent alerts, celebrations band, per-venue
// stats, Overview/Full-day detail toggle). Sibling of lib/events.ts and
// lib/config.ts.
// ---------------------------------------------------------------------------

/** One rostered shift. Times are minutes from midnight, Europe/London. */
export interface ShiftEntry {
  id: string;
  name: string;
  role: string;
  startMin: number;
  endMin: number;
}

export interface BriefTask {
  id: string;
  title: string;
  /** "Assigned to Amara · due 10.00" — pre-formatted display line. */
  meta: string;
  done: boolean;
}

export interface SlackMessage {
  id: string;
  author: string;
  time: string; // display form, e.g. "8.12am"
  text: string;
  isNew?: boolean;
}

/** A day's wrap-up for one venue (spec §7 — written in-app, shown next day). */
export interface WrapUp {
  headline: string;
  body: string;
  byline: string;
  postedAt: string; // display form, e.g. "22.40"
}

/** The current day's own wrap-up state, for the same-day editor: a shared
 *  draft that's being written through the day, or a published wrap. */
export interface WrapDraft extends WrapUp {
  draft: boolean;
}

export type AlertLevel = "urgent" | "heads-up";

export interface UrgentAlert {
  id: string;
  text: string;
  loc: "both" | VenueKey;
  level: AlertLevel;
  /** Last day the alert runs (inclusive, YYYY-MM-DD); null = single day. */
  until?: string | null;
}

export interface Milestone {
  venue: VenueKey | "both"; // "both" when the person's venue isn't known
  who: string;
  what: string; // "birthday today", "3 years today"
}

export interface StatTile {
  value: string;
  label: string;
}

/** An event slimmed down for the briefing column (links into /events/[id]). */
export interface BriefingEvent {
  id: string;
  time: string; // "7.30"
  ampm: string; // "pm"
  type: string;
  title: string;
  meta: string;
  desc: string;
  staff: string;
}

export interface VenueBriefing {
  roster: ShiftEntry[];
  tasks: BriefTask[];
  slack: SlackMessage[];
  /** Wrap-up covering the PREVIOUS day (that's what the page shows). */
  wrap: WrapUp | null;
  /** This day's own wrap-up (draft or published), for the same-day editor. */
  wrapToday: WrapDraft | null;
  stats: StatTile[];
  opening: { hours: string; note: string };
}

/** Everything /api/briefing returns except events (those come from Events). */
export interface BriefingDay {
  date: string; // YYYY-MM-DD
  /** When the roster cache was last refreshed ("HH.MM"), null in mock mode. */
  rosterAsOf: string | null;
  venues: Record<VenueKey, VenueBriefing>;
  alerts: UrgentAlert[];
  milestones: Milestone[];
}

// ---------------------------------------------------------------------------
// Per-venue presentation tokens, straight from the design file's LOC map.
// Prologue = brand book palette; Simply Books = its brand teal (#378573)
// applied the same way (spec §0).
// ---------------------------------------------------------------------------
export interface BriefingVenueTheme {
  name: string;
  place: string;
  accent: string;
  deep: string;
  tint: string;
  /** Text colour used on the accent-coloured bands. */
  soft: string;
  channel: string;
  wordmark: string;
  wmW: number;
  wmH: number;
}

export const BRIEFING_VENUES: Record<VenueKey, BriefingVenueTheme> = {
  prologue: {
    name: "Prologue",
    place: "Weir Mill, Stockport",
    accent: "#AD3B28",
    deep: "#8B2D1E",
    tint: "#FBDCDC",
    soft: "rgba(245,243,239,.72)",
    channel: "#pro-on-shift",
    wordmark: "/assets/prologue-wordmark-white.png",
    wmW: 112,
    wmH: 22,
  },
  simply: {
    name: "Simply Books",
    place: "Bramhall",
    accent: "#378573",
    deep: "#285F52",
    tint: "#E4F0EC",
    soft: "rgba(255,255,255,.80)",
    channel: "#sb-on-shift",
    wordmark: "/assets/simply-books-word-white.png",
    wmW: 123,
    wmH: 22,
  },
};

/** Column order on the two-column view (design: Prologue left). */
export const BRIEFING_COLUMNS: VenueKey[] = ["prologue", "simply"];

// Amber theme for the urgent-alert bar and "both venues" tags (design).
export const ALERT_THEME: Record<"both" | VenueKey, { c: string; t: string }> = {
  prologue: { c: "#AD3B28", t: "#FBDCDC" },
  simply: { c: "#378573", t: "#E4F0EC" },
  both: { c: "#B0812F", t: "#F6ECD6" },
};

// Two alert levels: urgent keeps the amber "read before shift" bar; heads-up
// is a calmer blue "good to know today" note. `border`/`bg`/`accent`/`label`
// style the panel; `title` heads it.
export const ALERT_LEVELS: Record<AlertLevel, {
  title: string;
  border: string;
  bg: string;
  accent: string;
  label: string;
}> = {
  urgent: {
    title: "Urgent — read before shift",
    border: "#E7D3A9",
    bg: "#FBF3E6",
    accent: "#B0812F",
    label: "#8A5A12",
  },
  "heads-up": {
    title: "Good to know today",
    border: "#CBDCEA",
    bg: "#EEF4F9",
    accent: "#3D6E96",
    label: "#2C4A63",
  },
};

export const ALERT_LEVEL_ORDER: AlertLevel[] = ["urgent", "heads-up"];

// ---------------------------------------------------------------------------
// Date/time helpers. The shops run on Europe/London; the server may not.
// ---------------------------------------------------------------------------

const LONDON = "Europe/London";

/** Today's date in the shops' timezone, as YYYY-MM-DD. */
export function todayLondon(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: LONDON, dateStyle: "short" }).format(now);
}

/** Minutes since midnight in Europe/London (for "on now" checks). */
export function nowMinLondon(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute");
}

/** date ± n days, calendar arithmetic on the YYYY-MM-DD string (no TZ). */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface DateParts {
  weekday: string; // "Saturday"
  wdShort: string; // "Sat"
  day: number; // 18
  dm: string; // "18 July"
  dmShort: string; // "Sat 18 Jul"
}

export function dateParts(iso: string): DateParts {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return {
    weekday: WEEKDAYS[wd],
    wdShort: WEEKDAYS_SHORT[wd],
    day: d,
    dm: `${d} ${MONTHS[m - 1]}`,
    dmShort: `${WEEKDAYS_SHORT[wd]} ${d} ${MONTHS_SHORT[m - 1]}`,
  };
}

/** "Today" / "Tomorrow" / "Yesterday" / "In 3 days" / "3 days ago". */
export function relLabel(offset: number): string {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";
  return offset > 0 ? `In ${offset} days` : `${-offset} days ago`;
}

/** 510 → "8.30am", 1020 → "5pm" (the design's compact shift-time format). */
export function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const mm = min % 60;
  const ap = h >= 12 ? "pm" : "am";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return `${hh}${mm ? "." + String(mm).padStart(2, "0") : ""}${ap}`;
}

/** "19:30" → { time: "7.30", ampm: "pm" } for the event card's big time. */
export function splitEventTime(hhmm: string): { time: string; ampm: string } {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm)) return { time: "TBC", ampm: "" };
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  let hh = h % 12;
  if (hh === 0) hh = 12;
  return { time: `${hh}${m ? "." + String(m).padStart(2, "0") : ""}`, ampm: ap };
}

export const onShiftNow = (s: ShiftEntry, nowMin: number) => nowMin >= s.startMin && nowMin < s.endMin;

/** Parse a clock token like "5.30pm", "11pm", "1am", "12pm" → minutes from
 *  midnight, or null. Used to time the end-of-day wrap-up reminder. */
export function parseClockToken(token: string): number | null {
  const m = token.trim().toLowerCase().match(/^(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm)$/);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  const min = m[2] ? Number(m[2]) : 0;
  if (m[3] === "pm") h += 12;
  return h * 60 + min;
}

/** The closing time from an "8am – 11pm" hours string, in minutes; null for
 *  "Closed today" or anything unparseable. */
export function parseCloseMinutes(hours: string): number | null {
  const parts = hours.split(/[–-]/);
  if (parts.length < 2) return null;
  return parseClockToken(parts[parts.length - 1]);
}

// ---------------------------------------------------------------------------
// Events → briefing cards (spec §3: reuse the Events module, don't re-query).
// ---------------------------------------------------------------------------
import type { ShowEvent } from "@/lib/types";

/** Which column(s) an event belongs to. Location is authoritative; venue
 *  name is the pre-migration fallback; unplaceable events show in both. */
export function eventVenues(e: ShowEvent): VenueKey[] {
  if (e.location === "Prologue") return ["prologue"];
  if (e.location === "Simply Books") return ["simply"];
  const v = e.venueName.toLowerCase();
  if (v.includes("prologue")) return ["prologue"];
  if (v.includes("simply")) return ["simply"];
  return ["prologue", "simply"];
}

export function toBriefingEvent(e: ShowEvent): BriefingEvent {
  const { time, ampm } = splitEventTime(e.time);
  const staff =
    e.roles.length > 0
      ? [...new Set(e.roles.flatMap((r) => r.staff.map((s) => s.name)))].join(", ")
      : e.legacyStaffing.join(", ");
  return {
    id: e.id,
    time,
    ampm,
    type: e.types[0] ?? "Event",
    title: e.name,
    meta: [e.venueName, e.hostName && `${e.hostName} hosting`].filter(Boolean).join(" · "),
    desc: e.format || e.notes || "",
    staff: staff || "TBC",
  };
}

/** The day's events, grouped into the two venue columns, sorted by time. */
export function briefingEvents(events: ShowEvent[], date: string): Record<VenueKey, BriefingEvent[]> {
  const out: Record<VenueKey, BriefingEvent[]> = { prologue: [], simply: [] };
  for (const e of events) {
    if (e.date !== date) continue;
    for (const venue of eventVenues(e)) out[venue].push(toBriefingEvent(e));
  }
  for (const venue of ["prologue", "simply"] as VenueKey[]) {
    out[venue].sort((a, b) => {
      const min = (ev: BriefingEvent) => {
        if (ev.time === "TBC") return 9999;
        const [h, m] = ev.time.split(".").map(Number);
        return ((h % 12) + (ev.ampm === "pm" ? 12 : 0)) * 60 + (m || 0);
      };
      return min(a) - min(b);
    });
  }
  return out;
}
