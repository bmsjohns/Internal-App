import type { EventVenue, Imprint, Pitch, PitchInput } from "@/lib/types";

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

  /** Phase 1 §6: select-only — no venue management screens. */
  listVenues(): Promise<EventVenue[]>;
  listImprints(): Promise<Imprint[]>;
}
