import type {
  EventAttachment,
  EventPhase,
  EventRole,
  EventVenue,
  Host,
  HostInput,
  Imprint,
  Location,
  Pitch,
  PitchAttachment,
  PitchInput,
  ScheduleItem,
  ShowEvent,
  ShowEventInput,
  StaffRef,
  Venue,
  VenueInput,
} from "@/lib/types";
import type { EventsDataSource } from "./events-source";

// Airtable REST implementation for the Events base — same style as
// lib/data/airtable.ts (no SDK, explicit field mapping), but pointed at the
// separate Events base. Table IDs pulled from the live base 16 Jul 2026.
//
// NOTE ON SCHEMA: the "Location" field (Simply Books / Prologue, mirroring
// the Orders module) does NOT exist in the live Event Pitching table yet —
// see README §Events. Until Ben approves that migration, leave
// EVENTS_AIRTABLE_HAS_LOCATION unset and this implementation neither reads
// nor writes it (location comes back null).

const API = "https://api.airtable.com/v0";
const CONTENT_API = "https://content.airtable.com/v0";
const DEFAULT_BASE = "apphUDuZ5u7NCisay";

const PITCHING_TABLE = "tblti02rr83EWtpb3";
const VENUES_TABLE = "tblh4JG6n17wU2vL4";
const IMPRINTS_TABLE = "tbl4lYmlB4GCklJDw";
const PUBLISHERS_TABLE = "tbllU4E1N1RHfW65c";
const EVENTS_TABLE = "tblfu5FnGG2WSiTNI";
const HOSTS_TABLE = "tblUMKv3c6Dcz2lRz";
// Phase 2 proposed tables — created by the migration, so addressed by NAME
// (the REST API accepts table names; ids don't exist until Ben approves).
const EVENT_ROLES_TABLE = "Event Roles";
const RUN_OF_SHOW_TABLE = "Run of Show";
const PITCH_DECK_FIELD = "fldWOvhcZI2xdoCmP";

const baseId = () => process.env.EVENTS_AIRTABLE_BASE_ID || DEFAULT_BASE;
const hasLocationField = () => process.env.EVENTS_AIRTABLE_HAS_LOCATION === "true";
// Phase 2 schema guard: the live Events table has NO Status/ISBN/From Pitch
// fields and no Event Roles / Run of Show tables yet. Until the migration in
// docs/events-phase2-migration.md is applied (sandbox first, Ben approves),
// leave this unset: events read as Confirmed with empty roles/schedule, and
// the API/UI disable the affected editors rather than silently dropping data.
export const hasPhase2Schema = () => process.env.EVENTS_AIRTABLE_HAS_PHASE2 === "true";

function apiKey(): string {
  const v = process.env.AIRTABLE_API_KEY;
  if (!v) throw new Error("Missing env var AIRTABLE_API_KEY");
  return v;
}

async function at(path: string, init?: RequestInit, root = API): Promise<any> {
  const res = await fetch(`${root}/${baseId()}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable ${res.status}: ${body}`);
  }
  return res.json();
}

async function atList(table: string): Promise<any[]> {
  const records: any[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    if (offset) params.set("offset", offset);
    const data = await at(`${table}?${params}`);
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

// Linked-record cells only carry record IDs over the REST API, so pitch
// mapping takes name indexes built from the Venues/Imprints/Publishers tables.
interface NameIndexes {
  venues: Map<string, string>;
  imprints: Map<string, string>;
  publishers: Map<string, string>;
  /** imprint id → its parent publisher's name (via Imprints.Publishers link). */
  imprintPublisher: Map<string, string>;
}

async function loadIndexes(): Promise<NameIndexes> {
  const [venues, imprints, publishers] = await Promise.all([
    atList(VENUES_TABLE),
    atList(IMPRINTS_TABLE),
    atList(PUBLISHERS_TABLE),
  ]);
  const toMap = (rs: any[], field: string) =>
    new Map<string, string>(rs.map((r) => [r.id, r.fields?.[field] ?? ""]));
  const pubNames = toMap(publishers, "Publisher Name");
  // Imprints' primary field is (mis)named "Publisher Name" pre-Phase-0;
  // the migration renames it "Imprint Name". Read whichever exists.
  const imprintName = (r: any) => r.fields?.["Imprint Name"] ?? r.fields?.["Publisher Name"] ?? "";
  return {
    venues: toMap(venues, "Name"),
    imprints: new Map(imprints.map((r) => [r.id, imprintName(r)])),
    publishers: pubNames,
    imprintPublisher: new Map(
      imprints.map((r) => {
        const parent: string[] = r.fields?.["Publishers"] ?? [];
        return [r.id, parent.map((pid) => pubNames.get(pid)).filter(Boolean)[0] ?? ""];
      })
    ),
  };
}

function toAttachment(a: any): PitchAttachment {
  return { id: a.id, filename: a.filename ?? "", url: a.url ?? "", size: a.size ?? 0 };
}

function toPitch(r: any, ix: NameIndexes): Pitch {
  const f = r.fields ?? {};
  const names = (ids: string[], map: Map<string, string>) =>
    ids.map((id) => map.get(id)).filter((n): n is string => !!n);
  // Pre-Phase-0 "Publisher" is a linked-record field (cell = record ids);
  // after the migration it becomes a lookup (cell = publisher name strings).
  // Accept both shapes so the app works on either side of the switchover.
  const publisherCell: string[] = f["Publisher"] ?? [];
  const publisherIds = publisherCell.filter((v) => ix.publishers.has(v));
  const imprintIds: string[] = f["Imprint"] ?? [];
  const venueIds: string[] = f["Proposed Venue(s)"] ?? [];
  // Publisher display order of precedence: derived from the imprint's parent
  // (the Phase-0-correct path), then whatever the Publisher cell holds —
  // record ids resolved to names pre-migration, name strings post-migration.
  const cellNames = publisherCell
    .map((v) => ix.publishers.get(v) ?? (v.startsWith("rec") ? "" : v))
    .filter(Boolean);
  const derivedNames = imprintIds.map((id) => ix.imprintPublisher.get(id) ?? "").filter(Boolean);
  const publisherNames = [...new Set([...derivedNames, ...cellNames])];
  return {
    id: r.id,
    authorName: f["Author Name"] ?? "",
    bookTitle: f["Book Title"] ?? "",
    isbn: f["ISBN"]?.text ?? "",
    publisherIds,
    publisherNames,
    imprintIds,
    imprintNames: names(imprintIds, ix.imprints),
    publicationDate: f["Publication Date"] ?? null,
    status: f["Status"] ?? "",
    priority: f["Priority"] ?? "",
    initialHighPriority: !!f["Initial High Priority"],
    leadName: f["Lead"]?.name ?? "",
    leadEmail: f["Lead"]?.email ?? "",
    publicist: f["Publicist"] ?? "",
    publicistEmail: f["Publicist's Email"] ?? "",
    pitchDeck: (f["Pitch Deck"] ?? []).map(toAttachment),
    proposedVenueIds: venueIds,
    proposedVenueNames: names(venueIds, ix.venues),
    proposedDates: f["Proposed Dates"] ?? "",
    estimatedAudienceSize: f["Estimated Audience Size"] ?? "",
    pitchingNotes: f["Pitching Notes"] ?? "",
    opportunityNotes: f["Opportunity Notes"] ?? "",
    rating: typeof f["Rating"] === "number" ? f["Rating"] : null,
    location: hasLocationField() ? ((f["Location"] as Location) ?? null) : null,
    createdAt: r.createdTime,
  };
}

function fromPitch(input: Partial<PitchInput>): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (input.authorName !== undefined) f["Author Name"] = input.authorName;
  if (input.bookTitle !== undefined) f["Book Title"] = input.bookTitle;
  if (input.isbn !== undefined) f["ISBN"] = input.isbn ? { text: input.isbn } : null;
  // Phase 1 §3.2: the app writes IMPRINT only; Publisher stays read-only and
  // becomes a derived lookup when the Phase 0 schema fix lands.
  if (input.imprintIds !== undefined) f["Imprint"] = input.imprintIds;
  if (input.publicationDate !== undefined) f["Publication Date"] = input.publicationDate;
  if (input.status !== undefined) f["Status"] = input.status || null;
  if (input.priority !== undefined) f["Priority"] = input.priority || null;
  if (input.initialHighPriority !== undefined) f["Initial High Priority"] = input.initialHighPriority;
  if (input.leadEmail !== undefined) f["Lead"] = input.leadEmail ? { email: input.leadEmail } : null;
  if (input.publicist !== undefined) f["Publicist"] = input.publicist;
  if (input.publicistEmail !== undefined) f["Publicist's Email"] = input.publicistEmail || null;
  if (input.proposedVenueIds !== undefined) f["Proposed Venue(s)"] = input.proposedVenueIds;
  if (input.proposedDates !== undefined) f["Proposed Dates"] = input.proposedDates;
  if (input.estimatedAudienceSize !== undefined) f["Estimated Audience Size"] = input.estimatedAudienceSize;
  if (input.pitchingNotes !== undefined) f["Pitching Notes"] = input.pitchingNotes;
  if (input.opportunityNotes !== undefined) f["Opportunity Notes"] = input.opportunityNotes;
  if (input.rating !== undefined) f["Rating"] = input.rating;
  if (hasLocationField() && input.location !== undefined) f["Location"] = input.location;
  return f;
}

function toVenue(r: any): EventVenue {
  const f = r.fields ?? {};
  return {
    id: r.id,
    name: f["Name"] ?? "",
    locations: (f["Location"] ?? []).map((l: any) => (typeof l === "string" ? l : l?.name ?? "")),
  };
}

// ---------------------------------------------------------------------------
// Phase 2 mapping — Events / Venues / Hosts
// ---------------------------------------------------------------------------

const toEventAttachment = (a: any): EventAttachment => ({
  id: a.id, filename: a.filename ?? "", url: a.url ?? "", size: a.size ?? 0,
});

// "Date and Time" is a single dateTime; the app models date + "HH:MM"
// separately. Read/write in Europe/London so a 7.30pm event is 7.30pm on the
// call sheet regardless of the server's timezone (Vercel runs UTC).
function londonParts(isoUtc: string): { date: string; time: string } {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function londonISO(date: string, time: string): string {
  const t = time || "00:00";
  // Find London's UTC offset on that date (0 or +1h) by round-tripping a guess.
  const guess = new Date(`${date}T${t}:00Z`);
  const offsetName = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "shortOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = offsetName.match(/GMT([+-]\d+)?/);
  const offset = m?.[1] ? Number(m[1]) : 0;
  return new Date(guess.getTime() - offset * 3600_000).toISOString();
}

const PHASE_LABELS: Record<EventPhase, string> = { pre: "Pre show", during: "During show", post: "Post show" };
const phaseFromLabel = (label: string): EventPhase =>
  (Object.entries(PHASE_LABELS).find(([, l]) => l === label)?.[0] as EventPhase) ?? "pre";

const parseStaffJson = (raw: string): StaffRef[] => {
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.filter((s) => s && typeof s.id === "string").map((s) => ({ id: s.id, name: s.name ?? s.id })) : [];
  } catch {
    return [];
  }
};

function toRole(r: any): EventRole & { eventId: string } {
  const f = r.fields ?? {};
  return {
    id: r.id,
    eventId: (f["Event"] ?? [])[0] ?? "",
    phase: phaseFromLabel(f["Phase"] ?? ""),
    name: f["Role"] ?? "",
    staff: parseStaffJson(f["Staff"] ?? ""),
  };
}

function toStep(r: any): ScheduleItem & { eventId: string } {
  const f = r.fields ?? {};
  return {
    id: r.id,
    eventId: (f["Event"] ?? [])[0] ?? "",
    time: f["Time"] ?? "",
    phase: phaseFromLabel(f["Phase"] ?? ""),
    title: f["Title"] ?? "",
    note: f["Note"] ?? "",
    leadId: f["Lead"] || null,
  };
}

interface EventChildren {
  roles: Map<string, EventRole[]>;
  schedule: Map<string, ScheduleItem[]>;
}

async function loadEventChildren(): Promise<EventChildren> {
  if (!hasPhase2Schema()) return { roles: new Map(), schedule: new Map() };
  const [roleRecs, stepRecs] = await Promise.all([
    atList(encodeURIComponent(EVENT_ROLES_TABLE)),
    atList(encodeURIComponent(RUN_OF_SHOW_TABLE)),
  ]);
  const roles = new Map<string, EventRole[]>();
  for (const rec of roleRecs) {
    const { eventId, ...role } = toRole(rec);
    if (!eventId) continue;
    if (!roles.has(eventId)) roles.set(eventId, []);
    roles.get(eventId)!.push(role);
  }
  const schedule = new Map<string, ScheduleItem[]>();
  for (const rec of stepRecs) {
    const { eventId, ...step } = toStep(rec);
    if (!eventId) continue;
    if (!schedule.has(eventId)) schedule.set(eventId, []);
    schedule.get(eventId)!.push(step);
  }
  return { roles, schedule };
}

function toShowEvent(
  r: any,
  venueNames: Map<string, string>,
  hostNames: Map<string, string>,
  children: EventChildren
): ShowEvent {
  const f = r.fields ?? {};
  const { date, time } = f["Date and Time"] ? londonParts(f["Date and Time"]) : { date: "", time: "" };
  const venueId = (f["Venue"] ?? [])[0] ?? null;
  const hostId = (f["Host"] ?? [])[0] ?? null;
  return {
    id: r.id,
    name: f["Name/Author"] ?? "",
    leadTitle: f["Lead Title"] ?? "",
    isbn: hasPhase2Schema() ? (f["ISBN"]?.text ?? "") : "",
    date,
    time,
    venueId,
    venueName: venueId ? venueNames.get(venueId) ?? "" : "",
    hostId,
    hostName: hostId ? hostNames.get(hostId) ?? "" : "",
    types: f["Event Type"] ?? [],
    ages: f["Age Group"] ?? [],
    format: f["Event Format"] ?? "",
    // Pre-migration there is no Status field: every live record is a real
    // booking, so they read as Confirmed (see docs/events-phase2-migration.md).
    status: hasPhase2Schema() ? (f["Status"] ?? "Confirmed") : "Confirmed",
    fromPitchId: hasPhase2Schema() ? ((f["From Pitch"] ?? [])[0] ?? null) : null,
    roles: children.roles.get(r.id) ?? [],
    schedule: children.schedule.get(r.id) ?? [],
    legacyStaffing: f["Staffing"] ?? [],
    bookTicket: typeof f["Book and Ticket"] === "number" ? f["Book and Ticket"] : null,
    ticketOnly: typeof f["Ticket Only"] === "number" ? f["Ticket Only"] : null,
    minOrder: typeof f["Minimum order"] === "number" ? f["Minimum order"] : null,
    lumaLink: f["Luma Link"] ?? "",
    banners: !!f["Banners"],
    callSheet: (f["Call Sheet"] ?? []).map(toEventAttachment),
    callSheetSent: !!f["Call Sheet Sent?"],
    salesReportSent: !!f["Sales Report Sent?"],
    mediaCount: (f["Media"] ?? []).length,
    notes: f["Notes"] ?? "",
    createdAt: r.createdTime,
  };
}

function fromShowEvent(input: Partial<ShowEventInput>): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (input.name !== undefined) f["Name/Author"] = input.name;
  if (input.leadTitle !== undefined) f["Lead Title"] = input.leadTitle;
  if (input.date !== undefined || input.time !== undefined) {
    // Callers sending either always send both (the editor holds them together).
    if (input.date) f["Date and Time"] = londonISO(input.date, input.time || "00:00");
    else f["Date and Time"] = null;
  }
  if (input.venueId !== undefined) f["Venue"] = input.venueId ? [input.venueId] : [];
  if (input.hostId !== undefined) f["Host"] = input.hostId ? [input.hostId] : [];
  if (input.types !== undefined) f["Event Type"] = input.types;
  if (input.ages !== undefined) f["Age Group"] = input.ages;
  if (input.format !== undefined) f["Event Format"] = input.format;
  if (input.bookTicket !== undefined) f["Book and Ticket"] = input.bookTicket;
  if (input.ticketOnly !== undefined) f["Ticket Only"] = input.ticketOnly;
  if (input.minOrder !== undefined) f["Minimum order"] = input.minOrder;
  if (input.lumaLink !== undefined) f["Luma Link"] = input.lumaLink || null;
  if (input.banners !== undefined) f["Banners"] = input.banners;
  if (input.callSheetSent !== undefined) f["Call Sheet Sent?"] = input.callSheetSent;
  if (input.salesReportSent !== undefined) f["Sales Report Sent?"] = input.salesReportSent;
  if (input.notes !== undefined) f["Notes"] = input.notes;
  if (hasPhase2Schema()) {
    if (input.status !== undefined) f["Status"] = input.status || null;
    if (input.isbn !== undefined) f["ISBN"] = input.isbn ? { text: input.isbn } : null;
    if (input.fromPitchId !== undefined) f["From Pitch"] = input.fromPitchId ? [input.fromPitchId] : [];
  }
  return f;
}

// Child-record sync: replace the event's roles / run-of-show rows wholesale.
// Counts are small (≤ ~25 per event) and nothing references the row ids, so
// delete-and-recreate beats a three-way diff. Airtable batches cap at 10.
const chunk = <T,>(arr: T[], n = 10): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

async function replaceChildren(table: string, eventId: string, rows: Record<string, unknown>[]): Promise<void> {
  const enc = encodeURIComponent(table);
  const existing = await atList(enc);
  const mine = existing.filter((r) => ((r.fields?.["Event"] ?? []) as string[])[0] === eventId);
  for (const ids of chunk(mine.map((r) => r.id))) {
    const params = new URLSearchParams();
    for (const id of ids) params.append("records[]", id);
    await at(`${enc}?${params}`, { method: "DELETE" });
  }
  for (const batch of chunk(rows)) {
    await at(enc, { method: "POST", body: JSON.stringify({ records: batch.map((fields) => ({ fields })) }) });
  }
}

async function syncEventChildren(eventId: string, input: Partial<ShowEventInput>): Promise<void> {
  if (!hasPhase2Schema()) return;
  if (input.roles !== undefined) {
    await replaceChildren(EVENT_ROLES_TABLE, eventId, input.roles.map((r) => ({
      Role: r.name,
      Event: [eventId],
      Phase: PHASE_LABELS[r.phase],
      Staff: JSON.stringify(r.staff),
    })));
  }
  if (input.schedule !== undefined) {
    await replaceChildren(RUN_OF_SHOW_TABLE, eventId, input.schedule.map((s) => ({
      Title: s.title,
      Event: [eventId],
      Time: s.time,
      Phase: PHASE_LABELS[s.phase],
      Note: s.note,
      Lead: s.leadId ?? "",
    })));
  }
}

function toFullVenue(r: any, eventIdsByVenue: Map<string, string[]>): Venue {
  const f = r.fields ?? {};
  return {
    id: r.id,
    name: f["Name"] ?? "",
    capacity: f["Capacity"] ?? "",
    locations: (f["Location"] ?? []).map((l: any) => (typeof l === "string" ? l : l?.name ?? "")),
    status: f["Status"] ?? "",
    tags: f["Tags"] ?? [],
    notes: f["Notes"] ?? "",
    techSpec: (f["Technical Spec"] ?? []).map(toEventAttachment),
    photo: (f["Photo"] ?? []).map(toEventAttachment),
    eventIds: eventIdsByVenue.get(r.id) ?? f["Events"] ?? [],
  };
}

function fromVenue(input: Partial<VenueInput>): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (input.name !== undefined) f["Name"] = input.name;
  if (input.capacity !== undefined) f["Capacity"] = input.capacity;
  if (input.locations !== undefined) f["Location"] = input.locations;
  if (input.status !== undefined) f["Status"] = input.status || null;
  if (input.tags !== undefined) f["Tags"] = input.tags;
  if (input.notes !== undefined) f["Notes"] = input.notes;
  return f;
}

function toHost(r: any): Host {
  const f = r.fields ?? {};
  const contacts = (f["Team Contact(s)"] ?? []) as any[];
  return {
    id: r.id,
    name: f["Name"] ?? "",
    phone: f["Phone"] ?? "",
    email: f["Email"] ?? "",
    fee: typeof f["Standard Fee"] === "number" ? f["Standard Fee"] : null,
    instagram: f["Instagram"] ?? "",
    notes: f["Notes"] ?? "",
    teamContacts: contacts.map((c) => ({ id: c?.id ?? "", name: c?.name ?? c?.email ?? "" })),
    eventIds: f["Events"] ?? [],
  };
}

function fromHost(input: Partial<HostInput>): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (input.name !== undefined) f["Name"] = input.name;
  if (input.phone !== undefined) f["Phone"] = input.phone || null;
  if (input.email !== undefined) f["Email"] = input.email || null;
  if (input.fee !== undefined) f["Standard Fee"] = input.fee;
  if (input.instagram !== undefined) f["Instagram"] = input.instagram || null;
  if (input.notes !== undefined) f["Notes"] = input.notes;
  // Team Contact(s) is a collaborator field keyed on Airtable users — the
  // app's staff ids are Clerk ids, so it stays read-only here (edit in
  // Airtable). Revisit if/when the migration adds a text-based field.
  return f;
}

const nameIndexOf = async (table: string, field = "Name") => {
  const recs = await atList(table);
  return new Map<string, string>(recs.map((r) => [r.id, r.fields?.[field] ?? ""]));
};

export const airtableEventsDataSource: EventsDataSource = {
  async listPitches() {
    const [records, ix] = await Promise.all([atList(PITCHING_TABLE), loadIndexes()]);
    return records.map((r) => toPitch(r, ix));
  },
  async getPitch(id) {
    try {
      const [record, ix] = await Promise.all([at(`${PITCHING_TABLE}/${id}`), loadIndexes()]);
      return toPitch(record, ix);
    } catch {
      return null;
    }
  },
  async createPitch(input) {
    const data = await at(PITCHING_TABLE, {
      method: "POST",
      body: JSON.stringify({ fields: fromPitch(input) }),
    });
    return toPitch(data, await loadIndexes());
  },
  async updatePitch(id, input) {
    const data = await at(`${PITCHING_TABLE}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: fromPitch(input) }),
    });
    return toPitch(data, await loadIndexes());
  },
  async deletePitch(id) {
    await at(`${PITCHING_TABLE}/${id}`, { method: "DELETE" });
  },

  async uploadPitchDeck(id, file) {
    // Airtable's attachment upload endpoint (content API, ≤5MB per file).
    await at(
      `${id}/${PITCH_DECK_FIELD}/uploadAttachment`,
      {
        method: "POST",
        body: JSON.stringify({
          contentType: file.contentType,
          filename: file.filename,
          file: file.base64,
        }),
      },
      CONTENT_API
    );
    const pitch = await this.getPitch(id);
    if (!pitch) throw new Error("Pitch not found after upload");
    return pitch;
  },

  async listVenues() {
    const records = await atList(VENUES_TABLE);
    return records.map(toVenue).sort((a, b) => a.name.localeCompare(b.name));
  },
  // --- Phase 2: Events ---
  async listEvents() {
    const [records, venueNames, hostNames, children] = await Promise.all([
      atList(EVENTS_TABLE),
      nameIndexOf(VENUES_TABLE),
      nameIndexOf(HOSTS_TABLE),
      loadEventChildren(),
    ]);
    return records.map((r) => toShowEvent(r, venueNames, hostNames, children));
  },
  async getEvent(id) {
    try {
      const [record, venueNames, hostNames, children] = await Promise.all([
        at(`${EVENTS_TABLE}/${id}`),
        nameIndexOf(VENUES_TABLE),
        nameIndexOf(HOSTS_TABLE),
        loadEventChildren(),
      ]);
      return toShowEvent(record, venueNames, hostNames, children);
    } catch {
      return null;
    }
  },
  async createEvent(input) {
    const data = await at(EVENTS_TABLE, {
      method: "POST",
      body: JSON.stringify({ fields: fromShowEvent(input) }),
    });
    await syncEventChildren(data.id, input);
    const created = await this.getEvent(data.id);
    if (!created) throw new Error("Event not found after create");
    return created;
  },
  async updateEvent(id, input) {
    const fields = fromShowEvent(input);
    if (Object.keys(fields).length > 0) {
      await at(`${EVENTS_TABLE}/${id}`, { method: "PATCH", body: JSON.stringify({ fields }) });
    }
    await syncEventChildren(id, input);
    const updated = await this.getEvent(id);
    if (!updated) throw new Error("Event not found after update");
    return updated;
  },
  async deleteEvent(id) {
    await at(`${EVENTS_TABLE}/${id}`, { method: "DELETE" });
  },

  // --- Phase 2: Venues ---
  async listVenuesFull() {
    const records = await atList(VENUES_TABLE);
    return records.map((r) => toFullVenue(r, new Map())).sort((a, b) => a.name.localeCompare(b.name));
  },
  async getVenue(id) {
    try {
      return toFullVenue(await at(`${VENUES_TABLE}/${id}`), new Map());
    } catch {
      return null;
    }
  },
  async createVenue(input) {
    const data = await at(VENUES_TABLE, { method: "POST", body: JSON.stringify({ fields: fromVenue(input) }) });
    return toFullVenue(data, new Map());
  },
  async updateVenue(id, input) {
    const data = await at(`${VENUES_TABLE}/${id}`, { method: "PATCH", body: JSON.stringify({ fields: fromVenue(input) }) });
    return toFullVenue(data, new Map());
  },

  // --- Phase 2: Hosts ---
  async listHosts() {
    const records = await atList(HOSTS_TABLE);
    return records.map(toHost).sort((a, b) => a.name.localeCompare(b.name));
  },
  async getHost(id) {
    try {
      return toHost(await at(`${HOSTS_TABLE}/${id}`));
    } catch {
      return null;
    }
  },
  async createHost(input) {
    const data = await at(HOSTS_TABLE, { method: "POST", body: JSON.stringify({ fields: fromHost(input) }) });
    return toHost(data);
  },
  async updateHost(id, input) {
    const data = await at(`${HOSTS_TABLE}/${id}`, { method: "PATCH", body: JSON.stringify({ fields: fromHost(input) }) });
    return toHost(data);
  },

  async listImprints() {
    const [imprints, publishers] = await Promise.all([atList(IMPRINTS_TABLE), atList(PUBLISHERS_TABLE)]);
    const pubNames = new Map<string, string>(publishers.map((r) => [r.id, r.fields?.["Publisher Name"] ?? ""]));
    return imprints
      .map((r) => {
        const f = r.fields ?? {};
        const linked: string[] = f["Publishers"] ?? [];
        return {
          id: r.id,
          name: f["Publisher Name"] ?? "",
          publisherName: linked.map((pid) => pubNames.get(pid)).filter(Boolean)[0] ?? "",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },
};
