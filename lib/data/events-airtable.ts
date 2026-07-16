import type { EventVenue, Imprint, Location, Pitch, PitchAttachment, PitchInput } from "@/lib/types";
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
const PITCH_DECK_FIELD = "fldWOvhcZI2xdoCmP";

const baseId = () => process.env.EVENTS_AIRTABLE_BASE_ID || DEFAULT_BASE;
const hasLocationField = () => process.env.EVENTS_AIRTABLE_HAS_LOCATION === "true";

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
