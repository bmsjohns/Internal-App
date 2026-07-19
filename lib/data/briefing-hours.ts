import type { VenueKey } from "@/lib/config";
import { backstageApi, briefingAirtableReady, dateEq } from "./briefing-airtable";

// Opening hours for the Daily Briefing, from the "Backstage" Airtable base.
// The shops keep a regular weekly pattern that shifts for events/book clubs
// and closes entirely on some days (Christmas), so two tables:
//   "Opening Hours"   — regular pattern, one row per venue × weekday
//   "Hours Overrides" — exceptions for a specific date (late night, or a
//                       full closure); "Both" applies to both venues
// Resolution for a date: an override wins; else that weekday's regular row;
// else the caller keeps its built-in fallback (mock OPENING).

const REGULAR_TABLE = "Opening Hours";
const OVERRIDES_TABLE = "Hours Overrides";

const VENUE_NAME: Record<VenueKey, string> = { prologue: "Prologue", simply: "Simply Books" };
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface Opening {
  hours: string;
  note: string;
}

interface HoursRow {
  Open?: string;
  Close?: string;
  Closed?: boolean;
  Note?: string;
}

/** YYYY-MM-DD → weekday name, TZ-independent (date-only arithmetic). */
export function weekdayOf(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Compose a row into the { hours, note } shape the design renders. */
export function formatHours(row: HoursRow): Opening {
  if (row.Closed) return { hours: "Closed today", note: (row.Note ?? "").trim() };
  const open = (row.Open ?? "").trim();
  const close = (row.Close ?? "").trim();
  const hours = open && close ? `${open} – ${close}` : open || close || "—";
  return { hours, note: (row.Note ?? "").trim() };
}

// Regular pattern changes rarely — cache the whole (14-row) table an hour.
let regularCache: { at: number; rows: any[] } | null = null;
const REGULAR_MS = 60 * 60 * 1000;

async function regularRows(): Promise<any[]> {
  if (regularCache && Date.now() - regularCache.at < REGULAR_MS) return regularCache.rows;
  const data = await backstageApi(encodeURIComponent(REGULAR_TABLE));
  const rows = (data.records ?? []).map((r: any) => r.fields);
  regularCache = { at: Date.now(), rows };
  return rows;
}

async function overrideRows(date: string): Promise<any[]> {
  const data = await backstageApi(
    `${encodeURIComponent(OVERRIDES_TABLE)}?filterByFormula=${encodeURIComponent(dateEq(date))}`
  );
  return (data.records ?? []).map((r: any) => r.fields);
}

/** Resolve opening hours per venue for a date, or null if the base isn't
 *  reachable. Venues with no matching row are omitted so the caller keeps
 *  its fallback for them. */
export async function getOpeningHours(date: string): Promise<Partial<Record<VenueKey, Opening>> | null> {
  if (!(await briefingAirtableReady())) return null;
  const weekday = weekdayOf(date);
  let reg: any[] = [];
  let over: any[] = [];
  try {
    [reg, over] = await Promise.all([regularRows(), overrideRows(date)]);
  } catch {
    return null; // hours table missing/unreadable — fall back to mock
  }

  const out: Partial<Record<VenueKey, Opening>> = {};
  for (const venue of ["prologue", "simply"] as VenueKey[]) {
    const name = VENUE_NAME[venue];
    const ov = over.find((r) => r.Venue === name || r.Venue === "Both");
    if (ov) {
      out[venue] = formatHours(ov);
      continue;
    }
    const row = reg.find((r) => r.Venue === name && r.Weekday === weekday);
    if (row) out[venue] = formatHours(row);
  }
  return out;
}
