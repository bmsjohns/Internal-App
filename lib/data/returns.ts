import type { ReturnsDataSource } from "./returns-source";
import { airtableReturnsDataSource } from "./returns-airtable";
import { mockReturnsDataSource } from "./returns-mock";

export function getReturnsDataSource(): ReturnsDataSource {
  return process.env.DATA_SOURCE === "airtable" ? airtableReturnsDataSource : mockReturnsDataSource;
}

export type { ReturnsDataSource } from "./returns-source";
