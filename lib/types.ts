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
