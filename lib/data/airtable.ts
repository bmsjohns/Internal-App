import type {
  Customer,
  CustomerInput,
  Order,
  OrderInput,
  Location,
  StatusLogEntry,
  Supplier,
  SupplierInput,
} from "@/lib/types";
import { CANONICAL_STATUSES, DEFAULT_LOCATION } from "@/lib/config";
import type { DataSource } from "./source";

// Airtable REST implementation. Uses the REST API directly (no SDK — smaller,
// and full control over typecast behaviour).
//
// NOTE ON SCHEMA: the V1 fields ("Location", "Notes") and V3 additions
// ("Publisher", "Price", "Quantity", "Status Log", and the "Suppliers"
// table) do not exist in the live base yet — see README §Schema migration.
// AIRTABLE_HAS_NEW_FIELDS defaults to false (matching the live base as it
// exists today) precisely so a fresh deploy is correct with zero migration
// flags set; set it to "true" only once that migration is applied.

const API = "https://api.airtable.com/v0";
const DEFAULT_BASE = "appAlp6BBobAiV0d6";
const ORDERS_TABLE = "tbl7kpDpf0XSrdtIS";
const CUSTOMERS_TABLE = "tbljs0vrDw7rgMofN";
// Created by the V3 migration; referenced by name until it exists.
const SUPPLIERS_TABLE = "Suppliers";

const baseId = () => process.env.AIRTABLE_BASE_ID || DEFAULT_BASE;

// "Status Log" is a long-text field of one line per change: ISO|name|status
function parseStatusLog(text: string): StatusLogEntry[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [at, by, ...rest] = l.split("|");
      return { at, by, status: rest.join("|") };
    })
    .filter((e) => e.at && e.status);
}

export const serializeStatusLog = (log: StatusLogEntry[]) =>
  log.map((e) => [e.at, e.by, e.status].join("|")).join("\n");

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

const hasNewFields = () => process.env.AIRTABLE_HAS_NEW_FIELDS === "true";

// Airtable allows 5 requests/second per base, and every /api/orders hit lists
// two tables — a few quick navigations used to trip RATE_LIMIT_REACHED in
// production. Two defences: at() retries 429s with backoff, and list reads
// are coalesced + cached briefly (below).

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETRY_LIMIT = 3;
// Cap the wait so a retry can't blow the serverless function timeout even if
// Airtable sends a large Retry-After.
const MAX_RETRY_WAIT_MS = 5_000;

async function at(path: string, init?: RequestInit): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}/${baseId()}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env("AIRTABLE_API_KEY")}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    });
    if (res.status === 429 && attempt < RETRY_LIMIT) {
      const retryAfter = Number(res.headers.get("Retry-After")) * 1000;
      await sleep(Math.min(retryAfter > 0 ? retryAfter : 400 * 2 ** attempt, MAX_RETRY_WAIT_MS));
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable ${res.status}: ${body}`);
    }
    return res.json();
  }
}

async function atList(table: string, extra?: Record<string, string>): Promise<any[]> {
  const records: any[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams(extra);
    if (offset) params.set("offset", offset);
    const data = await at(`${table}?${params}`);
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

// The base holds years of order history (6k+ rows — 60+ paginated requests
// per full list), but the app only ever surfaces open orders plus recent
// history. Closed orders older than the window stay in Airtable and are
// simply not loaded; open orders always load regardless of age, so nothing
// actionable can fall off the queue. CREATED_TIME() is used instead of the
// "Order Date" field because that field may not exist in the live base yet
// (toOrder falls back to createdTime for the same reason).
const CLOSED_STATUS_KEYS = new Set(["collected", "cant-get", "cancelled"]);

function ordersWindowFormula(): string {
  const months = Number(process.env.ORDERS_WINDOW_MONTHS) || 12;
  const closed = CANONICAL_STATUSES.filter((s) => CLOSED_STATUS_KEYS.has(s.key)).flatMap((s) => s.raw);
  const isClosed = `OR(${closed.map((o) => `{Status}="${o}"`).join(",")})`;
  return `OR(NOT(${isClosed}), IS_AFTER(CREATED_TIME(), DATEADD(NOW(), -${months}, 'months')))`;
}

// Full-history search, matching the same fields the orders page searches
// client-side. {Customers} renders linked customers' names in formulas, so
// customer-name search works without a join.
const escapeFormulaString = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

function ordersSearchFormula(query: string): string {
  const q = escapeFormulaString(query.toLowerCase());
  return `SEARCH("${q}", LOWER({Book Title} & " " & {Author} & " " & {ISBN} & " " & ARRAYJOIN({Customers}, " ")))`;
}

// Per-table list cache: concurrent callers share one in-flight request, and
// the result is reused for a few seconds. Writes invalidate so the caller who
// mutated sees their change immediately; other serverless instances have
// their own cache, so cross-instance staleness is bounded by the TTL.
const LIST_CACHE_TTL_MS = 10_000;
const listCache = new Map<string, { at: number; records: Promise<any[]> }>();

function cachedList(table: string, extra?: Record<string, string>, key = table): Promise<any[]> {
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.at < LIST_CACHE_TTL_MS) return hit.records;
  const records = atList(table, extra).catch((e) => {
    listCache.delete(key);
    throw e;
  });
  listCache.set(key, { at: Date.now(), records });
  return records;
}

// Cache keys are `table` or `table:suffix` (e.g. per-query search results),
// so clearing a table also drops every derived entry for it.
export function clearListCache(table?: string) {
  if (!table) return listCache.clear();
  for (const key of listCache.keys()) {
    if (key === table || key.startsWith(`${table}:`)) listCache.delete(key);
  }
}

function toOrder(r: any): Order {
  const f = r.fields ?? {};
  return {
    id: r.id,
    bookTitle: f["Book Title"] ?? "",
    author: f["Author"] ?? "",
    isbn: f["ISBN"]?.text ?? "",
    customerIds: f["Customers"] ?? [],
    customerPhone: (f["Phone (from Customers)"] ?? [])[0],
    teamMember: f["Team Member"] ?? "",
    paid: f["Paid?"] ?? "",
    status: f["Status"] ?? "",
    specialOrder: !!f["Special Order?"],
    isPreorder: !!f["Is preorder?"],
    preorderPublicationDate: f["Pre-order Publication Date"] ?? null,
    estimatedLeadTime: f["Estimated Lead Time?"] ?? null,
    deliveryMethod: f["Delivery Method"] ?? "",
    location: (f["Location"] as Location) ?? DEFAULT_LOCATION,
    notes: f["Notes"] ?? "",
    publisher: f["Publisher"] ?? "",
    price: typeof f["Price"] === "number" ? f["Price"] : null,
    quantity: typeof f["Quantity"] === "number" && f["Quantity"] > 0 ? f["Quantity"] : 1,
    statusLog: parseStatusLog(f["Status Log"] ?? ""),
    orderDate: f["Order Date"] ?? r.createdTime,
    lastModified: f["Last Modified"] ?? r.createdTime,
  };
}

function fromOrder(input: Partial<OrderInput>): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (input.bookTitle !== undefined) f["Book Title"] = input.bookTitle;
  if (input.author !== undefined) f["Author"] = input.author;
  if (input.isbn !== undefined) f["ISBN"] = input.isbn ? { text: input.isbn } : null;
  if (input.customerIds !== undefined) f["Customers"] = input.customerIds;
  if (input.teamMember !== undefined && input.teamMember) f["Team Member"] = input.teamMember;
  if (input.paid !== undefined) f["Paid?"] = input.paid || null;
  if (input.status !== undefined) f["Status"] = input.status || null;
  if (input.specialOrder !== undefined) f["Special Order?"] = input.specialOrder;
  if (input.isPreorder !== undefined) f["Is preorder?"] = input.isPreorder;
  if (input.preorderPublicationDate !== undefined)
    f["Pre-order Publication Date"] = input.preorderPublicationDate;
  if (input.estimatedLeadTime !== undefined) f["Estimated Lead Time?"] = input.estimatedLeadTime;
  if (input.deliveryMethod !== undefined) f["Delivery Method"] = input.deliveryMethod || null;
  if (hasNewFields()) {
    if (input.location !== undefined) f["Location"] = input.location;
    if (input.notes !== undefined) f["Notes"] = input.notes;
    if (input.publisher !== undefined) f["Publisher"] = input.publisher;
    if (input.price !== undefined) f["Price"] = input.price;
    if (input.quantity !== undefined) f["Quantity"] = input.quantity;
    if (input.statusLog !== undefined) f["Status Log"] = serializeStatusLog(input.statusLog);
  }
  return f;
}

function toSupplier(r: any): Supplier {
  const f = r.fields ?? {};
  return {
    id: r.id,
    name: f["Name"] ?? "",
    cadence: f["Cadence"] ?? "",
    accountNumber: f["Account Number"] ?? "",
  };
}

function fromSupplier(input: Partial<SupplierInput>): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (input.name !== undefined) f["Name"] = input.name;
  if (input.cadence !== undefined) f["Cadence"] = input.cadence;
  if (input.accountNumber !== undefined) f["Account Number"] = input.accountNumber;
  return f;
}

function toCustomer(r: any): Customer {
  const f = r.fields ?? {};
  return {
    id: r.id,
    name: f["Name"] ?? "",
    email: f["Email"] ?? "",
    phone: f["Phone"] ?? "",
    address: f["Address"] ?? "",
    notes: f["Notes"] ?? "",
    orderIds: f["Orders"] ?? [],
  };
}

function fromCustomer(input: Partial<CustomerInput>): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (input.name !== undefined) f["Name"] = input.name;
  if (input.email !== undefined) f["Email"] = input.email;
  if (input.phone !== undefined) f["Phone"] = input.phone;
  if (input.address !== undefined) f["Address"] = input.address;
  if (input.notes !== undefined) f["Notes"] = input.notes;
  return f;
}

// Order writes also invalidate the customer cache: the Customers link field
// updates the linked customer's Orders rollup.
function invalidateOrders() {
  clearListCache(ORDERS_TABLE);
  clearListCache(CUSTOMERS_TABLE);
}

export const airtableDataSource: DataSource = {
  async listOrders() {
    const records = await cachedList(ORDERS_TABLE, { filterByFormula: ordersWindowFormula() });
    return records.map(toOrder);
  },
  async searchOrders(query) {
    const q = query.trim();
    if (!q) return [];
    const records = await cachedList(
      ORDERS_TABLE,
      { filterByFormula: ordersSearchFormula(q) },
      `${ORDERS_TABLE}:search:${q.toLowerCase()}`
    );
    return records.map(toOrder);
  },
  async getOrdersByIds(ids) {
    // OR(RECORD_ID()=…) keeps each formula well under Airtable's length
    // limits at 50 ids per request; most customers need a single request.
    const records: any[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const formula = `OR(${chunk.map((id) => `RECORD_ID()="${id}"`).join(",")})`;
      records.push(...(await atList(ORDERS_TABLE, { filterByFormula: formula })));
    }
    return records.map(toOrder);
  },
  async getOrder(id) {
    try {
      return toOrder(await at(`${ORDERS_TABLE}/${id}`));
    } catch {
      return null;
    }
  },
  async createOrder(input) {
    const data = await at(ORDERS_TABLE, {
      method: "POST",
      body: JSON.stringify({ fields: fromOrder(input) }),
    });
    invalidateOrders();
    return toOrder(data);
  },
  async updateOrder(id, input) {
    const data = await at(`${ORDERS_TABLE}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: fromOrder(input) }),
    });
    invalidateOrders();
    return toOrder(data);
  },
  async deleteOrder(id) {
    await at(`${ORDERS_TABLE}/${id}`, { method: "DELETE" });
    invalidateOrders();
  },

  async listCustomers() {
    const records = await cachedList(CUSTOMERS_TABLE);
    return records.map(toCustomer);
  },
  async getCustomer(id) {
    try {
      return toCustomer(await at(`${CUSTOMERS_TABLE}/${id}`));
    } catch {
      return null;
    }
  },
  async createCustomer(input) {
    const data = await at(CUSTOMERS_TABLE, {
      method: "POST",
      body: JSON.stringify({ fields: fromCustomer(input) }),
    });
    clearListCache(CUSTOMERS_TABLE);
    return toCustomer(data);
  },
  async updateCustomer(id, input) {
    const data = await at(`${CUSTOMERS_TABLE}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: fromCustomer(input) }),
    });
    clearListCache(CUSTOMERS_TABLE);
    return toCustomer(data);
  },

  async listSuppliers() {
    if (!hasNewFields()) return [];
    const records = await cachedList(SUPPLIERS_TABLE);
    return records.map(toSupplier);
  },
  async createSupplier(input) {
    const data = await at(SUPPLIERS_TABLE, {
      method: "POST",
      body: JSON.stringify({ fields: fromSupplier(input) }),
    });
    clearListCache(SUPPLIERS_TABLE);
    return toSupplier(data);
  },
  async updateSupplier(id, input) {
    const data = await at(`${SUPPLIERS_TABLE}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: fromSupplier(input) }),
    });
    clearListCache(SUPPLIERS_TABLE);
    return toSupplier(data);
  },
  async deleteSupplier(id) {
    await at(`${SUPPLIERS_TABLE}/${id}`, { method: "DELETE" });
    clearListCache(SUPPLIERS_TABLE);
  },
};
