import type { DataSource } from "./source";
import { airtableDataSource } from "./airtable";
import { mockDataSource } from "./mock";

// DATA_SOURCE=mock keeps development/testing off the live Airtable base
// (spec §2a.3). Production sets DATA_SOURCE=airtable.
export function getDataSource(): DataSource {
  return process.env.DATA_SOURCE === "airtable" ? airtableDataSource : mockDataSource;
}

export type { DataSource } from "./source";
