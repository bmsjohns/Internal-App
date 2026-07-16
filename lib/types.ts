export type Location = "Simply Books" | "Prologue";

export const LOCATIONS: Location[] = ["Simply Books", "Prologue"];

/** One status change, recorded by the timeline control (V3 §5 audit trail). */
export interface StatusLogEntry {
  at: string; // ISO timestamp
  by: string; // user's name
  status: string; // raw Airtable status written
}

export interface Order {
  id: string;
  bookTitle: string;
  author: string;
  isbn: string;
  customerIds: string[];
  customerName?: string;
  customerPhone?: string;
  teamMember: string;
  paid: string;
  status: string;
  specialOrder: boolean;
  isPreorder: boolean;
  preorderPublicationDate: string | null;
  estimatedLeadTime: string | null;
  deliveryMethod: string;
  location: Location;
  notes: string;
  /** V3: supplier/publisher the order is (to be) placed with. */
  publisher: string;
  /** V3: retail price, if recorded. */
  price: number | null;
  /** V3: copies on this order line (default 1). */
  quantity: number;
  statusLog: StatusLogEntry[];
  orderDate: string;
  lastModified: string;
}

export type OrderInput = Omit<
  Order,
  "id" | "orderDate" | "lastModified" | "customerName" | "customerPhone"
>;

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  orderIds: string[];
}

export type CustomerInput = Omit<Customer, "id" | "orderIds">;

/** V3 §3: per-supplier settings (ordering cadence + shop account number). */
export interface Supplier {
  id: string;
  name: string;
  cadence: string; // free text: "Same day", "Tue & Thu", …
  accountNumber: string;
}

export type SupplierInput = Omit<Supplier, "id">;

// ---------------------------------------------------------------------------
// Events module, Phase 1: Pitching (separate Airtable base — see lib/data/events*)
// ---------------------------------------------------------------------------

export interface PitchAttachment {
  id: string;
  filename: string;
  url: string;
  size: number;
}

export interface Pitch {
  id: string;
  authorName: string;
  bookTitle: string;
  isbn: string;
  /** Legacy direct Publisher link — read-only in the UI; Phase 0 will make it a lookup. */
  publisherIds: string[];
  publisherNames: string[];
  /** The primary link point going forward: pitch → Imprint. */
  imprintIds: string[];
  imprintNames: string[];
  publicationDate: string | null;
  status: string; // raw Airtable option; canonical stage derived via lib/pitching
  priority: string;
  initialHighPriority: boolean;
  leadName: string;
  leadEmail: string;
  publicist: string;
  publicistEmail: string;
  pitchDeck: PitchAttachment[];
  proposedVenueIds: string[];
  proposedVenueNames: string[];
  proposedDates: string; // free text in the base — flagged, out of scope to fix
  estimatedAudienceSize: string; // also free text — same flag
  pitchingNotes: string;
  opportunityNotes: string; // Airtable rich text (markdown)
  rating: number | null;
  /** New field, not in the live base yet — guarded by EVENTS_AIRTABLE_HAS_LOCATION. */
  location: Location | null;
  createdAt: string;
}

export type PitchInput = Omit<
  Pitch,
  "id" | "createdAt" | "publisherIds" | "publisherNames" | "imprintNames" | "proposedVenueNames" | "leadName" | "pitchDeck"
>;

/** Venue option for the Proposed Venue(s) picker — read-only in Phase 1 (§6). */
export interface EventVenue {
  id: string;
  name: string;
  locations: string[]; // Venues.Location multi-select (Bramhall/Stockport/Manchester)
}

/** Imprint option; publisherName resolved from the Imprints→Publishers link. */
export interface Imprint {
  id: string;
  name: string;
  publisherName: string;
}

// ---------------------------------------------------------------------------
// Events module, Phase 2: Events / Venues / Hosts (+ call sheets)
// ---------------------------------------------------------------------------

export type EventPhase = "pre" | "during" | "post";

/** A person who can be put on an event — same identity as the Clerk user
 *  (spec §6.1: one source of truth for "who is this person"). In mock mode
 *  ids are slugs; with Clerk they are Clerk user ids. */
export interface StaffRef {
  id: string;
  name: string;
}

/**
 * One role on one event: phase + role name + assigned people. Stored as
 * structured records (not a denormalised blob) SPECIFICALLY so a future
 * "apply role template" feature (spec §6, out of scope this phase) can
 * insert a set of these programmatically without a redesign.
 */
export interface EventRole {
  id: string;
  phase: EventPhase;
  name: string;
  staff: StaffRef[];
}

/**
 * One timed step in the run of show. `leadId` is a StaffRef id, or the
 * sentinel "host" (the event's host/chair leads that step), or null
 * (unassigned). Same structured-records rationale as EventRole.
 */
export interface ScheduleItem {
  id: string;
  time: string; // "HH:MM", 24h — timezone-proof for a same-day schedule
  phase: EventPhase;
  title: string;
  note: string;
  leadId: string | null;
}

export interface EventAttachment {
  id: string;
  filename: string;
  url: string;
  size: number;
}

export interface ShowEvent {
  id: string;
  name: string; // Name/Author — the headline
  leadTitle: string;
  isbn: string; // proposed new field — pre-migration always ""
  date: string; // "YYYY-MM-DD", "" when TBC
  time: string; // "HH:MM", "" when TBC
  venueId: string | null;
  venueName: string;
  hostId: string | null;
  hostName: string;
  types: string[]; // Event Type multi-select (raw Airtable options)
  ages: string[]; // Age Group multi-select (raw Airtable options)
  format: string; // Event Format rich text (markdown)
  status: string; // proposed new single select; canonical set in lib/events
  fromPitchId: string | null; // proposed new link to Event Pitching
  roles: EventRole[];
  schedule: ScheduleItem[];
  /** Legacy Staffing multi-select (first names) — displayed read-only until
   *  the roles migration retires it. */
  legacyStaffing: string[];
  bookTicket: number | null;
  ticketOnly: number | null;
  minOrder: number | null;
  lumaLink: string;
  banners: boolean;
  callSheet: EventAttachment[];
  callSheetSent: boolean;
  salesReportSent: boolean;
  mediaCount: number;
  notes: string;
  createdAt: string;
}

export type ShowEventInput = Omit<
  ShowEvent,
  "id" | "createdAt" | "venueName" | "hostName" | "callSheet" | "mediaCount" | "legacyStaffing"
>;

export interface Venue {
  id: string;
  name: string;
  capacity: string; // singleLineText in the live base ("150", "60 seated")
  locations: string[]; // venue's own area: Bramhall / Stockport / Manchester
  status: string;
  tags: string[];
  notes: string;
  techSpec: EventAttachment[];
  photo: EventAttachment[];
  eventIds: string[];
}

export type VenueInput = Omit<Venue, "id" | "techSpec" | "photo" | "eventIds">;

export interface Host {
  id: string;
  name: string;
  phone: string;
  email: string;
  fee: number | null; // Standard Fee (currency)
  instagram: string;
  notes: string;
  teamContacts: StaffRef[];
  eventIds: string[];
}

export type HostInput = Omit<Host, "id" | "eventIds" | "teamContacts"> & {
  teamContactIds: string[];
};

export type Role = "staff" | "manager";

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  /** Venues this user's manager powers apply to. "all" = joint manager across both. */
  managerLocations: Location[] | "all";
  /** Permission strings (V3: `settings:manage`). Defaults derive from role. */
  permissions: string[];
}
