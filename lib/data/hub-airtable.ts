import type {
  AuditEntry,
  DiscountRates,
  HubLine,
  HubLineInput,
  HubLineState,
  HubOrderType,
  HubPublisher,
  HubPublisherInput,
  Location,
  RestockItem,
  RestockItemInput,
} from "@/lib/types";
import type { HubDataSource } from "./hub-source";
import {
  atBase,
  atBaseList,
  parseLog,
  requireBackstageBase,
  requireBookClubsBase,
  serialiseLog,
} from "./backstage-base";
import { parseImprints, serialiseImprints } from "@/lib/hub";

// Airtable implementation of the Ordering Hub seam. Two bases:
//
//  · "Hub Lines" + "Restock" — app-owned tables in the Backstage base
//    (created 19 Jul 2026). Hub Lines is the ONE central ordering table;
//    sources keep their own records and tie in via Source + Source Link.
//  · Publishers — the EXISTING Publishers table in the live Book Clubs base
//    (Ben: centralise discounts there). Mapping quirks, all handled here:
//    discounts are stored as FRACTIONS (0.53 = 53%); "Standard Discount
//    Terms" is the restock/base rate; "Account Number" is the Simply Books
//    account and "Prologue Account No" (added Jul 2026) its pair; Imprints
//    is comma-separated text with quoted names. The leftover
//    "Schools/Event Discouny" field is ignored (Events Discount replaces it).

const LINES = "Hub Lines";
const RESTOCK = "Restock";
const PUBLISHERS = "Publishers";

const SOURCE_FROM: Record<string, HubLine["source"]> = {
  "Book Club": "bookclub", Events: "events", Schools: "schools", Customer: "customer",
};
const SOURCE_TO: Record<HubLine["source"], string> = {
  bookclub: "Book Club", events: "Events", schools: "Schools", customer: "Customer",
};
const TYPE_FROM: Record<string, HubOrderType> = {
  Restock: "restock", "Book Club": "bookclub", Events: "events", Schools: "schools",
};
const TYPE_TO: Record<HubOrderType, string> = {
  restock: "Restock", bookclub: "Book Club", events: "Events", schools: "Schools",
};
const STATE_FROM = (v: unknown): HubLineState =>
  v === "Pending" ? "pending" : v === "Ordered" ? "ordered" : v === "Arrived" ? "arrived" : "draft";
const STATE_TO: Record<HubLineState, string> = {
  draft: "Draft", pending: "Pending", ordered: "Ordered", arrived: "Arrived",
};

const toLine = (r: any): HubLine => {
  const f = r.fields ?? {};
  return {
    id: r.id,
    title: f["Title"] ?? "",
    isbn: f["ISBN"] ?? "",
    quantity: Number(f["Quantity"] ?? 0),
    publisherId: f["Publisher ID"] || null,
    imprint: f["Imprint"] ?? "",
    rrp: f["RRP"] != null ? Number(f["RRP"]) : null,
    source: SOURCE_FROM[f["Source"]] ?? "customer",
    sourceLabel: f["Source Label"] ?? "",
    sourceLink: f["Source Link"] ?? "",
    account: (f["Account"] as Location) || null,
    orderType: TYPE_FROM[f["Order Type"]] ?? "restock",
    state: STATE_FROM(f["State"]),
    draftKey: f["Draft Key"] || null,
    createdAt: f["Created At"] ?? r.createdTime ?? "",
    sentAt: f["Sent At"] || null,
    sentBy: f["Sent By"] ?? "",
    sentMethod: (f["Sent Method"] as HubLine["sentMethod"]) ?? "",
    sentCopy: f["Sent Copy"] ?? "",
    arrivedAt: f["Arrived At"] || null,
    log: parseLog(f["Log"]),
  };
};

// Publisher name cache for the denormalised "Publisher Name" column.
let pubNameCache: { at: number; names: Map<string, string> } | null = null;

async function publisherNames(): Promise<Map<string, string>> {
  if (pubNameCache && Date.now() - pubNameCache.at < 60_000) return pubNameCache.names;
  const rows = await atBaseList(await requireBookClubsBase("Ordering Hub"), PUBLISHERS);
  const names = new Map<string, string>(rows.map((r) => [r.id, String(r.fields?.["Publisher Name"] ?? "").trim()]));
  pubNameCache = { at: Date.now(), names };
  return names;
}

async function fromLineInput(l: HubLineInput): Promise<Record<string, unknown>> {
  const names = l.publisherId ? await publisherNames() : new Map<string, string>();
  return {
    Title: l.title,
    ISBN: l.isbn,
    Quantity: l.quantity,
    "Publisher ID": l.publisherId ?? "",
    "Publisher Name": l.publisherId ? (names.get(l.publisherId) ?? "") : "",
    Imprint: l.imprint,
    RRP: l.rrp,
    Source: SOURCE_TO[l.source],
    "Source Label": l.sourceLabel,
    "Source Link": l.sourceLink,
    Account: l.account ?? null,
    "Order Type": TYPE_TO[l.orderType],
    State: STATE_TO.draft,
    "Draft Key": l.draftKey ?? "",
    "Created At": new Date().toISOString(),
  };
}

// Live Publishers-table field mapping. Rates are FRACTIONS in Airtable.
const RATE_FIELDS: Record<HubOrderType, string> = {
  restock: "Standard Discount Terms",
  bookclub: "Book Club Discount",
  events: "Events Discount",
  schools: "Schools Discount",
};

const pctFrom = (v: unknown): number | null =>
  v == null || v === "" ? null : Math.round(Number(v) * 10000) / 100;
const pctTo = (v: number | null): number | null => (v == null ? null : v / 100);

const toPublisher = (r: any): HubPublisher => {
  const f = r.fields ?? {};
  const rates = {} as DiscountRates;
  for (const [type, field] of Object.entries(RATE_FIELDS) as [HubOrderType, string][]) {
    rates[type] = pctFrom(f[field]);
  }
  return {
    id: r.id,
    name: String(f["Publisher Name"] ?? "").trim(),
    repName: String(f["Rep Name"] ?? "").trim(),
    repEmail: String(f["Rep Email"] ?? "").trim(),
    accountNumbers: {
      "Simply Books": String(f["Account Number"] ?? "").trim(),
      "Prologue": String(f["Prologue Account No"] ?? "").trim(),
    },
    imprints: parseImprints(f["Imprints"]),
    rates,
    // The live table has no per-account rate fields — the rare exception
    // (spec C6) gets fields only if a real divergent rate ever appears.
    accountOverrides: {},
  };
};

function fromPublisher(input: Partial<HubPublisherInput>): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (input.name !== undefined) f["Publisher Name"] = input.name;
  if (input.repName !== undefined) f["Rep Name"] = input.repName;
  if (input.repEmail !== undefined) f["Rep Email"] = input.repEmail;
  if (input.accountNumbers) {
    f["Account Number"] = input.accountNumbers["Simply Books"] ?? "";
    f["Prologue Account No"] = input.accountNumbers["Prologue"] ?? "";
  }
  if (input.rates) {
    for (const [type, field] of Object.entries(RATE_FIELDS) as [HubOrderType, string][]) {
      f[field] = pctTo(input.rates[type]);
    }
  }
  if (input.imprints !== undefined) f["Imprints"] = serialiseImprints(input.imprints);
  return f;
}

const toRestock = (r: any): RestockItem => {
  const f = r.fields ?? {};
  return {
    id: r.id,
    title: f["Title"] ?? "",
    isbn: f["ISBN"] ?? "",
    quantity: Number(f["Quantity"] ?? 0),
    location: (f["Location"] as Location) ?? "Simply Books",
    by: f["By"] ?? "",
    supplier: f["Supplier"] ?? "",
    createdAt: f["Created At"] ?? r.createdTime ?? "",
    handledAt: f["Handled At"] || null,
    handledBy: f["Handled By"] ?? "",
  };
};

async function base(): Promise<string> {
  return requireBackstageBase("Ordering Hub");
}

const entry = (by: string, action: string): AuditEntry => ({ at: new Date().toISOString(), by, action });

async function patchLine(baseId: string, line: HubLine, fields: Record<string, unknown>, logEntry: AuditEntry): Promise<HubLine> {
  const r = await atBase(baseId, `${encodeURIComponent(LINES)}/${line.id}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: { ...fields, Log: serialiseLog([...line.log, logEntry]) } }),
  });
  return toLine(r);
}

async function listActiveLines(baseId: string, formula?: string): Promise<HubLine[]> {
  const guard = `{State} != "Deleted"`;
  return (
    await atBaseList(baseId, LINES, {
      filterByFormula: formula ? `AND(${guard}, ${formula})` : guard,
    })
  ).map(toLine);
}

export const airtableHubDataSource: HubDataSource = {
  async listLines() {
    return listActiveLines(await base());
  },
  async getLine(id) {
    try {
      return toLine(await atBase(await base(), `${encodeURIComponent(LINES)}/${id}`));
    } catch {
      return null;
    }
  },

  async createDraft(inputs, byName) {
    const baseId = await base();
    const draftKey = inputs[0]?.draftKey || `d${Date.now().toString(36)}`;
    const records = await Promise.all(
      inputs.map(async (i) => ({
        fields: {
          ...(await fromLineInput({ ...i, draftKey: i.draftKey ?? draftKey })),
          Log: serialiseLog([entry(byName, "Staged as draft")]),
        },
      }))
    );
    const out: HubLine[] = [];
    // Airtable caps batch creates at 10 records.
    for (let i = 0; i < records.length; i += 10) {
      const data = await atBase(baseId, encodeURIComponent(LINES), {
        method: "POST",
        body: JSON.stringify({ records: records.slice(i, i + 10) }),
      });
      out.push(...data.records.map(toLine));
    }
    return out;
  },
  async upsertSourceDraft(input, byName) {
    const baseId = await base();
    const existing = await listActiveLines(
      baseId,
      `AND({Source} = "${SOURCE_TO[input.source]}", {Source Link} = "${input.sourceLink}", {State} = "Draft")`
    );
    if (existing[0]) {
      return patchLine(
        baseId,
        existing[0],
        {
          Title: input.title, ISBN: input.isbn, Quantity: input.quantity,
          "Publisher ID": input.publisherId ?? "",
          "Publisher Name": input.publisherId ? ((await publisherNames()).get(input.publisherId) ?? "") : "",
          Imprint: input.imprint, RRP: input.rrp,
          Account: input.account ?? null,
        },
        entry(byName, "Draft updated from source")
      );
    }
    const [line] = await this.createDraft([input], byName);
    return line;
  },
  async updateDraftLine(id, patch) {
    const baseId = await base();
    const line = await this.getLine(id);
    if (!line || line.state !== "draft") throw new Error("Draft line not found");
    const fields: Record<string, unknown> = {};
    if (patch.quantity != null) fields["Quantity"] = Math.max(0, Math.floor(patch.quantity));
    if (patch.title !== undefined) fields["Title"] = patch.title;
    if (patch.isbn !== undefined) fields["ISBN"] = patch.isbn;
    if (patch.publisherId !== undefined) {
      fields["Publisher ID"] = patch.publisherId ?? "";
      fields["Publisher Name"] = patch.publisherId ? ((await publisherNames()).get(patch.publisherId) ?? "") : "";
    }
    if (patch.imprint !== undefined) fields["Imprint"] = patch.imprint;
    if (patch.rrp !== undefined) fields["RRP"] = patch.rrp;
    const r = await atBase(baseId, `${encodeURIComponent(LINES)}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields }),
    });
    return toLine(r);
  },
  async setDraftAccount(draftKey, account, byName) {
    const baseId = await base();
    const lines = await listActiveLines(baseId, `AND({Draft Key} = "${draftKey}", {State} = "Draft")`);
    for (const l of lines) await patchLine(baseId, l, { Account: account }, entry(byName, `Assigned to ${account}`));
  },
  async deleteDraft(draftKey, byName) {
    const baseId = await base();
    const lines = await listActiveLines(baseId, `AND({Draft Key} = "${draftKey}", {State} = "Draft")`);
    for (const l of lines) await patchLine(baseId, l, { State: "Deleted" }, entry(byName, "Draft deleted"));
    return lines;
  },
  async pushDraft(draftKey, byName) {
    const baseId = await base();
    const lines = await listActiveLines(baseId, `AND({Draft Key} = "${draftKey}", {State} = "Draft")`);
    if (lines.length === 0) throw new Error("Draft not found");
    if (lines.some((l) => !l.account)) throw new Error("Assign an account before pushing");
    const out: HubLine[] = [];
    for (const l of lines) out.push(await patchLine(baseId, l, { State: STATE_TO.pending }, entry(byName, "Pushed to hub (pending)")));
    return out;
  },

  async markSent(publisherId, account, method, byName, sentCopy) {
    const baseId = await base();
    const lines = await listActiveLines(
      baseId,
      `AND({State} = "Pending", {Publisher ID} = "${publisherId}", {Account} = "${account}")`
    );
    const now = new Date().toISOString();
    const out: HubLine[] = [];
    for (const l of lines) {
      out.push(
        await patchLine(
          baseId,
          l,
          { State: STATE_TO.ordered, "Sent At": now, "Sent By": byName, "Sent Method": method, "Sent Copy": sentCopy },
          entry(byName, `Sent via ${method}`)
        )
      );
    }
    return out;
  },

  async markArrived(lineIds, byName) {
    const baseId = await base();
    const now = new Date().toISOString();
    const out: HubLine[] = [];
    for (const id of lineIds) {
      const line = await this.getLine(id);
      if (!line || line.state !== "ordered") continue;
      out.push(await patchLine(baseId, line, { State: STATE_TO.arrived, "Arrived At": now }, entry(byName, "Marked arrived")));
    }
    return out;
  },

  async listPublishers() {
    const rows = await atBaseList(await requireBookClubsBase("Ordering Hub"), PUBLISHERS);
    return rows.map(toPublisher).sort((a, b) => a.name.localeCompare(b.name));
  },
  async createPublisher(input) {
    const r = await atBase(await requireBookClubsBase("Ordering Hub"), encodeURIComponent(PUBLISHERS), {
      method: "POST",
      body: JSON.stringify({ fields: fromPublisher(input) }),
    });
    pubNameCache = null;
    return toPublisher(r);
  },
  async updatePublisher(id, input) {
    const r = await atBase(await requireBookClubsBase("Ordering Hub"), `${encodeURIComponent(PUBLISHERS)}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: fromPublisher(input) }),
    });
    pubNameCache = null;
    return toPublisher(r);
  },

  async listRestock() {
    return (await atBaseList(await base(), RESTOCK)).map(toRestock);
  },
  async addRestock(input: RestockItemInput) {
    const r = await atBase(await base(), encodeURIComponent(RESTOCK), {
      method: "POST",
      body: JSON.stringify({
        fields: {
          Title: input.title, ISBN: input.isbn, Quantity: input.quantity,
          Location: input.location, By: input.by, Supplier: input.supplier,
          "Created At": new Date().toISOString(),
        },
      }),
    });
    return toRestock(r);
  },
  async handleRestock(id, byName) {
    const r = await atBase(await base(), `${encodeURIComponent(RESTOCK)}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: { "Handled At": new Date().toISOString(), "Handled By": byName } }),
    });
    return toRestock(r);
  },
};
