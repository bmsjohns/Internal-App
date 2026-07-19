import type { VenueKey } from "@/lib/config";

// Square adapter for the Management Dashboard's sales ledger. Reads only:
// completed orders per location per London day, split into the dashboard's
// retail/café/bar/events buckets via the catalog's category names.
//
// Setup (see docs/dashboard-sales-integration.md): SQUARE_ACCESS_TOKEN with
// ORDERS_READ + MERCHANT_PROFILE_READ (+ ITEMS_READ for the catalog split).
// Locations are discovered by NAME (Ben's no-IDs rule) — a location whose
// name mentions "Simply" or "Prologue" — with SQUARE_LOCATION_ID_SIMPLY /
// SQUARE_LOCATION_ID_PROLOGUE as override escape hatches. If the two shops
// turn out to be separate Square accounts, this needs a token per account —
// flag to Ben, the code currently assumes one account/two locations.

const SQUARE_BASE = "https://connect.squareup.com/v2";
const SQUARE_VERSION = process.env.SQUARE_API_VERSION ?? "2025-01-23";

export function squareConfigured(): boolean {
  return !!process.env.SQUARE_ACCESS_TOKEN?.trim();
}

async function sq(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${SQUARE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN?.trim()}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Square ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// London day boundaries (Square wants RFC3339 with offset)
// ---------------------------------------------------------------------------

function londonOffset(dateIso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    timeZoneName: "shortOffset",
  }).formatToParts(new Date(`${dateIso}T12:00:00Z`));
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = raw.match(/GMT([+-]\d+)?/);
  const hours = Number(m?.[1] ?? 0);
  return `${hours < 0 ? "-" : "+"}${String(Math.abs(hours)).padStart(2, "0")}:00`;
}

export function londonDayRange(dateIso: string): { startAt: string; endAt: string } {
  const next = new Date(new Date(`${dateIso}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
  return { startAt: `${dateIso}T00:00:00${londonOffset(dateIso)}`, endAt: `${next}T00:00:00${londonOffset(next)}` };
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

let locationCache: { at: number; byVenue: Partial<Record<VenueKey, string>> } | null = null;
const LOCATION_CACHE_MS = 24 * 60 * 60 * 1000;

export async function squareLocations(): Promise<Partial<Record<VenueKey, string>>> {
  const overrides: Partial<Record<VenueKey, string>> = {};
  if (process.env.SQUARE_LOCATION_ID_SIMPLY) overrides.simply = process.env.SQUARE_LOCATION_ID_SIMPLY;
  if (process.env.SQUARE_LOCATION_ID_PROLOGUE) overrides.prologue = process.env.SQUARE_LOCATION_ID_PROLOGUE;
  if (overrides.simply && overrides.prologue) return overrides;
  if (locationCache && Date.now() - locationCache.at < LOCATION_CACHE_MS) return { ...locationCache.byVenue, ...overrides };
  const data = await sq("/locations");
  const byVenue: Partial<Record<VenueKey, string>> = {};
  for (const loc of data.locations ?? []) {
    const name = String(loc.name ?? "").toLowerCase();
    if (name.includes("simply")) byVenue.simply ??= loc.id;
    if (name.includes("prologue") || name.includes("weir")) byVenue.prologue ??= loc.id;
  }
  locationCache = { at: Date.now(), byVenue };
  return { ...byVenue, ...overrides };
}

// ---------------------------------------------------------------------------
// Catalog → category bucket
// ---------------------------------------------------------------------------

export type SquareBucket = "retail" | "cafe" | "bar" | "events";

/** Map a Square category NAME to a dashboard bucket. Overridable without a
 *  deploy via SQUARE_CATEGORY_MAP='{"Coffee bar":"cafe", ...}' once Ben
 *  confirms the account's real category names. */
export function bucketOfCategoryName(name: string): SquareBucket {
  try {
    const map = JSON.parse(process.env.SQUARE_CATEGORY_MAP ?? "{}");
    const explicit = map[name];
    if (explicit === "retail" || explicit === "cafe" || explicit === "bar" || explicit === "events") return explicit;
  } catch {
    /* bad JSON → keyword fallback */
  }
  const n = name.toLowerCase();
  if (/(bar|drink|beer|wine|spirit|cocktail|alcohol)/.test(n)) return "bar";
  if (/(caf|coffee|food|kitchen|bakery|cake|pastr)/.test(n)) return "cafe";
  if (/(event|ticket)/.test(n)) return "events";
  return "retail";
}

interface CatalogMap {
  variationToItem: Map<string, string>;
  itemToCategory: Map<string, string>; // item id → category NAME
}

let catalogCache: { at: number; map: CatalogMap } | null = null;
const CATALOG_CACHE_MS = 24 * 60 * 60 * 1000;

async function catalogMap(): Promise<CatalogMap> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_CACHE_MS) return catalogCache.map;
  const categories = new Map<string, string>(); // category id → name
  const map: CatalogMap = { variationToItem: new Map(), itemToCategory: new Map() };
  let cursor: string | undefined;
  do {
    const data = await sq(`/catalog/list?types=ITEM,CATEGORY${cursor ? `&cursor=${cursor}` : ""}`);
    for (const obj of data.objects ?? []) {
      if (obj.type === "CATEGORY") categories.set(obj.id, String(obj.category_data?.name ?? ""));
      if (obj.type === "ITEM") {
        const categoryId = obj.item_data?.reporting_category?.id ?? obj.item_data?.category_id;
        if (categoryId) map.itemToCategory.set(obj.id, categoryId);
        for (const variation of obj.item_data?.variations ?? []) map.variationToItem.set(variation.id, obj.id);
      }
    }
    cursor = data.cursor;
  } while (cursor);
  // Second pass: category ids → names.
  for (const [item, categoryId] of map.itemToCategory) map.itemToCategory.set(item, categories.get(categoryId) ?? "");
  catalogCache = { at: Date.now(), map };
  return map;
}

// ---------------------------------------------------------------------------
// Day totals
// ---------------------------------------------------------------------------

export interface SquareDay {
  total: number; // GBP
  cats: Record<SquareBucket, number>;
}

/** Gross takings for one venue on one London day, bucketed by category.
 *  Completed orders only; refunds are ignored in v1 (documented). */
export async function fetchSquareDay(venue: VenueKey, dateIso: string): Promise<SquareDay | null> {
  const locations = await squareLocations();
  const locationId = locations[venue];
  if (!locationId) return null; // venue not on this Square account
  const { startAt, endAt } = londonDayRange(dateIso);
  const catalog = await catalogMap().catch(() => null); // split degrades to retail-only
  const cats: Record<SquareBucket, number> = { retail: 0, cafe: 0, bar: 0, events: 0 };
  let total = 0;
  let cursor: string | undefined;
  do {
    const body = {
      location_ids: [locationId],
      cursor,
      limit: 500,
      query: {
        filter: {
          state_filter: { states: ["COMPLETED"] },
          date_time_filter: { closed_at: { start_at: startAt, end_at: endAt } },
        },
        sort: { sort_field: "CLOSED_AT" },
      },
    };
    const data = await sq("/orders/search", { method: "POST", body: JSON.stringify(body) });
    for (const order of data.orders ?? []) {
      for (const line of order.line_items ?? []) {
        const amount = Number(line.total_money?.amount ?? 0) / 100;
        total += amount;
        const itemId = catalog?.variationToItem.get(String(line.catalog_object_id ?? ""));
        const categoryName = itemId ? (catalog?.itemToCategory.get(itemId) ?? "") : "";
        cats[bucketOfCategoryName(categoryName)] += amount;
      }
    }
    cursor = data.cursor;
  } while (cursor);
  return { total, cats };
}
