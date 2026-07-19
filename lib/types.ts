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
  /** Owning shop, distinct from the venue's geographic area. */
  location?: Location | null;
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

// ---------------------------------------------------------------------------
// Regular Events — Book Clubs, Phase 1 (book-clubs-ordering-hub spec Part B)
//
// Members stay ENTIRELY separate from Customers in this phase — no linking,
// matching or merging (spec B1, deliberate deferral). "Club" is modelled with
// a `kind` field so language classes / writing groups extend the same tables
// later without rework (spec Part D), but only book-club UI exists.
// ---------------------------------------------------------------------------

/** One audit-trail line, same shape as Orders' Status Log (spec B2). */
export interface AuditEntry {
  at: string; // ISO timestamp
  by: string; // user's name
  action: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  stripeCustomerId: string;
  /** CRM-style free-text notes. */
  notes: string;
}

export type MemberInput = Omit<Member, "id">;

/** Future supertype seam: book clubs now; classes/groups later (spec D). */
export type ClubKind = "book-club" | "language-class" | "writing-group";
export type ClubStatus = "active" | "paused" | "inactive";

export interface Club {
  id: string;
  name: string;
  kind: ClubKind;
  location: Location;
  description: string;
  genre: string;
  /** Meeting cadence, free text: "First Tuesday · monthly". */
  cadence: string;
  stripePriceId: string;
  status: ClubStatus;
  /** Manually-set target size, e.g. for room capacity. Going over is fine
   *  (a club can squeeze someone in) — this is guidance, not a hard cap.
   *  null when nobody's set it yet. */
  memberCapacity: number | null;
}

export type ClubInput = Omit<Club, "id">;

export type MembershipStatus = "active" | "paused" | "cancelled";
/** Payment standing, kept live by Stripe webhooks (spec B2). */
export type PayStatus = "ok" | "failed" | "past_due";

/** Join table: Member × Club × Stripe subscription (spec B1). */
export interface ClubMembership {
  id: string;
  memberId: string;
  clubId: string;
  stripeSubscriptionId: string;
  status: MembershipStatus;
  joined: string; // YYYY-MM-DD
  payStatus: PayStatus;
  /** Display-only card hint from Stripe, e.g. "•••• 4242 (expires soon)". */
  cardLabel: string;
  /** Current period end (renewal date), YYYY-MM-DD. */
  periodEnd: string;
  /** Monthly fee in GBP. */
  amount: number;
  log: AuditEntry[];
}

/** One row per Club × Month. Order status is NOT stored here — the linked
 *  hub line owns it and this record reflects it (spec B4/C4). */
export interface BookSelection {
  id: string;
  clubId: string;
  month: string; // "YYYY-MM"
  title: string;
  isbn: string;
  publisherId: string | null;
  imprint: string;
  rrp: number | null;
  selectedBy: string;
  selectedAt: string; // ISO
  hostCopy: boolean;
  /** Exact active-member count at selection time (+1 if hostCopy). */
  quantity: number;
  hubLineId: string | null;
}

export type BookSelectionInput = Omit<BookSelection, "id" | "selectedAt" | "selectedBy" | "hubLineId">;

/** A member's Stripe invoice history (read-only; refunds link out, spec B2). */
export interface PaymentRecord {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  status: "succeeded" | "failed" | "refunded";
  description: string;
}

// ---------------------------------------------------------------------------
// Ordering Hub (spec Part C)
// ---------------------------------------------------------------------------

/** Where an order line was staged from (C2). Restock is deliberately NOT a
 *  source — it never enters the send/receive lifecycle (C1/C5). */
export type HubSource = "bookclub" | "events" | "schools" | "customer";

/** Order types that carry their own discount rate (C6). Customer orders use
 *  the restock/base rate. */
export type HubOrderType = "restock" | "bookclub" | "events" | "schools";

export type HubLineState = "draft" | "pending" | "ordered" | "arrived";

export interface HubLine {
  id: string;
  title: string;
  isbn: string;
  quantity: number;
  publisherId: string | null;
  imprint: string;
  rrp: number | null;
  source: HubSource;
  /** Human label, e.g. "Book Club — Killer Lines". */
  sourceLabel: string;
  /** Originating record id (selection/event/school/order). NOT editable —
   *  this is what makes arrival write back correctly (C2/C4). */
  sourceLink: string;
  /** Trading account. Mandatory before push, no default (C2). */
  account: Location | null;
  orderType: HubOrderType;
  state: HubLineState;
  /** Groups lines staged together so they review/push as one draft card. */
  draftKey: string | null;
  createdAt: string; // ISO
  sentAt: string | null;
  sentBy: string;
  sentMethod: "Email" | "CSV" | "";
  /** Exact copy of what was sent, stored against the batch (C3). */
  sentCopy: string;
  arrivedAt: string | null;
  log: AuditEntry[];
}

export type HubLineInput = Omit<
  HubLine,
  "id" | "createdAt" | "sentAt" | "sentBy" | "sentMethod" | "sentCopy" | "arrivedAt" | "log" | "state"
>;

/** Per-order-type discount rates (straight % off RRP — no volume tiers, C6).
 *  null = no own rate → falls back to restock (the base). */
export type DiscountRates = {
  [K in HubOrderType]: number | null;
};

/**
 * Reference data: one row per publisher, staff-maintained (C6). Lives with
 * rep contacts (Events base Publishers table, Imprints as children — reused,
 * not duplicated). Rates are Publisher × Order Type applying to BOTH
 * accounts; `accountOverrides` is the rare per-account exception, visually
 * flagged. Imprints always inherit the parent rate — no imprint override.
 */
export interface HubPublisher {
  id: string;
  name: string;
  repName: string;
  repEmail: string;
  /** Account numbers are per-account: every publisher holds two (C6). */
  accountNumbers: Record<Location, string>;
  imprints: string[];
  rates: DiscountRates;
  accountOverrides: Partial<Record<Location, Partial<DiscountRates>>>;
}

export type HubPublisherInput = Omit<HubPublisher, "id">;

/** Shop-floor restock capture (C5) — decision-support only, never sent by
 *  the Hub. Lifecycle ends at handed-off-to-Batchline. */
export interface RestockItem {
  id: string;
  title: string;
  isbn: string;
  quantity: number;
  location: Location;
  by: string;
  /** Supplier/publisher name for grouping + Settings cadence lookup. */
  supplier: string;
  createdAt: string; // ISO
  handledAt: string | null;
  handledBy: string;
}

export type RestockItemInput = Omit<RestockItem, "id" | "createdAt" | "handledAt" | "handledBy">;

// ---------------------------------------------------------------------------
// Returns module (returns-module spec, Jul 2026)
//
// Replaces the old Returns Airtable process. One shared queue fed by two
// sources (general stock + Phase 6 post-event reconciliation); requests are
// always itemised; nothing ships without an RA. Publisher reference data is
// the Ordering Hub's — reused, not duplicated.
// ---------------------------------------------------------------------------

export type ReturnOrigin = "general" | "event";
/** "" = not chosen yet — choosing one is required before submission. */
export type ReturnRoute = "" | "direct" | "gardners";
export type ReturnStatus = "requested" | "awaiting" | "approved" | "shipped" | "credit";

export interface ReturnLine {
  id: string;
  title: string;
  isbn: string;
  quantity: number;
  /** Optional: slow-moving / damaged / overstock / event-unsold. */
  reason: string;
  /** Optional: new / shelf-worn / damaged — useful on RA forms. */
  condition: string;
  rrp: number | null;
  /** Pick-list progress: copies scanned off the shelf, 0..quantity. */
  picked: number;
}

export type ReturnLineInput = Omit<ReturnLine, "id" | "picked">;

export interface ReturnRequest {
  id: string;
  /** Human-facing code, e.g. "RTN-0142". */
  code: string;
  location: Location;
  origin: ReturnOrigin;
  /** Event name for at-a-glance context (origin === "event"). */
  eventRef: string;
  /** Link back to the originating Event record, when event-originated. */
  eventId: string | null;
  /** Ben / Events Lead who verified the post-event count (event origin). */
  verifiedBy: string;
  /** Hub Publishers reference — imprints resolve to the parent publisher. */
  publisherId: string | null;
  route: ReturnRoute;
  status: ReturnStatus;
  raNumber: string;
  /** Uploaded approval form (PDF/screenshot); "" when none attached. */
  raFilename: string;
  requestedBy: string;
  dateRequested: string; // YYYY-MM-DD
  dateSubmitted: string | null;
  dateApproved: string | null;
  dateShipped: string | null;
  dateCreditConfirmed: string | null;
  /** Publisher's confirmed credit — optional, recorded off the credit note. */
  creditAmount: number | null;
  notes: string;
  lines: ReturnLine[];
  log: AuditEntry[];
}

export interface ReturnRequestInput {
  location: Location;
  origin: ReturnOrigin;
  eventRef: string;
  eventId: string | null;
  verifiedBy: string;
  publisherId: string | null;
  notes: string;
  lines: ReturnLineInput[];
}

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
