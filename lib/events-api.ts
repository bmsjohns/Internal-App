import type { EventPhase, EventRole, HostInput, Location, ScheduleItem, ShowEventInput, VenueInput } from "@/lib/types";
import { EVENT_STATUSES } from "@/lib/events";

// Body → typed input parsing shared by the Events/Venues/Hosts API routes.
// Same philosophy as the Orders/Pitching routes: never trust the client,
// never write a select option Airtable doesn't already have.

const PHASES: EventPhase[] = ["pre", "during", "post"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseRoles(v: unknown): EventRole[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((r) => r && typeof r === "object" && PHASES.includes(r.phase) && typeof r.name === "string" && r.name.trim())
    .map((r, i) => ({
      id: str(r.id) || `role-${i}`,
      phase: r.phase as EventPhase,
      name: r.name.trim(),
      staff: Array.isArray(r.staff)
        ? r.staff
            .filter((s: unknown): s is { id: string; name?: string } => !!s && typeof (s as any).id === "string")
            .map((s: { id: string; name?: string }) => ({ id: s.id, name: str(s.name) || s.id }))
        : [],
    }));
}

export function parseSchedule(v: unknown): ScheduleItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (s) =>
        s && typeof s === "object" && PHASES.includes(s.phase) && typeof s.title === "string" && s.title.trim() &&
        typeof s.time === "string" && TIME_RE.test(s.time)
    )
    .map((s, i) => ({
      id: str(s.id) || `step-${i}`,
      time: s.time,
      phase: s.phase as EventPhase,
      title: s.title.trim(),
      note: str(s.note),
      leadId: typeof s.leadId === "string" && s.leadId ? s.leadId : null,
    }));
}

const KNOWN_STATUSES = EVENT_STATUSES.map((s) => s.writeAs);

/** Full-body parse for POST; PATCH picks the keys the client actually sent. */
export function parseEventBody(body: any): ShowEventInput {
  return {
    name: str(body.name).trim(),
    leadTitle: str(body.leadTitle).trim(),
    isbn: str(body.isbn).trim(),
    date: /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : "",
    time: TIME_RE.test(body.time) ? body.time : "",
    venueId: str(body.venueId) || null,
    location: (["Simply Books", "Prologue"] as Location[]).includes(body.location) ? body.location : null,
    hostId: str(body.hostId) || null,
    types: strArr(body.types),
    ages: strArr(body.ages),
    format: str(body.format),
    status: KNOWN_STATUSES.includes(body.status) ? body.status : "Draft",
    fromPitchId: str(body.fromPitchId) || null,
    roles: parseRoles(body.roles),
    schedule: parseSchedule(body.schedule),
    bookTicket: numOrNull(body.bookTicket),
    ticketOnly: numOrNull(body.ticketOnly),
    minOrder: numOrNull(body.minOrder),
    lumaLink: str(body.lumaLink).trim(),
    banners: !!body.banners,
    callSheetSent: !!body.callSheetSent,
    salesReportSent: !!body.salesReportSent,
    notes: str(body.notes),
  };
}

export function parseVenueBody(body: any): VenueInput {
  return {
    name: str(body.name).trim(),
    capacity: str(body.capacity).trim(),
    locations: strArr(body.locations),
    status: str(body.status),
    tags: strArr(body.tags),
    notes: str(body.notes),
  };
}

export function parseHostBody(body: any): HostInput {
  return {
    name: str(body.name).trim(),
    phone: str(body.phone).trim(),
    email: str(body.email).trim(),
    fee: numOrNull(body.fee),
    instagram: str(body.instagram).trim(),
    notes: str(body.notes),
    teamContactIds: strArr(body.teamContactIds),
  };
}
