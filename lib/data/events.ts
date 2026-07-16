import type { EventsDataSource } from "./events-source";
import { airtableEventsDataSource } from "./events-airtable";
import { mockEventsDataSource } from "./events-mock";

// Same switch as lib/data/index.ts — DATA_SOURCE=mock keeps development off
// the live Events base; production sets DATA_SOURCE=airtable.
export function getEventsDataSource(): EventsDataSource {
  return process.env.DATA_SOURCE === "airtable" ? airtableEventsDataSource : mockEventsDataSource;
}

export type { EventsDataSource } from "./events-source";
