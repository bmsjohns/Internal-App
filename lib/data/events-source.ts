import type {
  EventVenue,
  Host,
  HostInput,
  Imprint,
  Pitch,
  PitchInput,
  ShowEvent,
  ShowEventInput,
  Venue,
  VenueInput,
} from "@/lib/types";

// Events lives in a SEPARATE Airtable base from Customer Orders (Phase 1
// spec §1), so it gets its own DataSource-shaped seam. Same rules as
// lib/data/source.ts: every page and API route goes through this interface.
export interface EventsDataSource {
  listPitches(): Promise<Pitch[]>;
  getPitch(id: string): Promise<Pitch | null>;
  createPitch(input: PitchInput): Promise<Pitch>;
  updatePitch(id: string, input: Partial<PitchInput>): Promise<Pitch>;
  deletePitch(id: string): Promise<void>;
  /** Upload a pitch-deck file onto a pitch record. */
  uploadPitchDeck(id: string, file: { filename: string; contentType: string; base64: string }): Promise<Pitch>;

  /** Phase 1 §6: select-only picker options (kept for the pitching editor). */
  listVenues(): Promise<EventVenue[]>;
  listImprints(): Promise<Imprint[]>;

  // --- Phase 2: Events (confirmed bookings) ---
  listEvents(): Promise<ShowEvent[]>;
  getEvent(id: string): Promise<ShowEvent | null>;
  createEvent(input: ShowEventInput): Promise<ShowEvent>;
  updateEvent(id: string, input: Partial<ShowEventInput>): Promise<ShowEvent>;
  deleteEvent(id: string): Promise<void>;

  // --- Phase 2: Venues (full CRUD, unlike Phase 1's read-only picker) ---
  listVenuesFull(): Promise<Venue[]>;
  getVenue(id: string): Promise<Venue | null>;
  createVenue(input: VenueInput): Promise<Venue>;
  updateVenue(id: string, input: Partial<VenueInput>): Promise<Venue>;

  // --- Phase 2: Hosts ---
  listHosts(): Promise<Host[]>;
  getHost(id: string): Promise<Host | null>;
  createHost(input: HostInput): Promise<Host>;
  updateHost(id: string, input: Partial<HostInput>): Promise<Host>;
}
