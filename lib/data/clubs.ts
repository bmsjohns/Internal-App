import type { ClubsDataSource } from "./clubs-source";
import { airtableClubsDataSource } from "./clubs-airtable";
import { mockClubsDataSource } from "./clubs-mock";

// Same switch as lib/data/index.ts — DATA_SOURCE=mock keeps development off
// Airtable AND Stripe entirely.
export function getClubsDataSource(): ClubsDataSource {
  return process.env.DATA_SOURCE === "airtable" ? airtableClubsDataSource : mockClubsDataSource;
}

export type { ClubsDataSource } from "./clubs-source";
