import type { HubDataSource } from "./hub-source";
import { airtableHubDataSource } from "./hub-airtable";
import { mockHubDataSource } from "./hub-mock";

export function getHubDataSource(): HubDataSource {
  return process.env.DATA_SOURCE === "airtable" ? airtableHubDataSource : mockHubDataSource;
}

export type { HubDataSource } from "./hub-source";
