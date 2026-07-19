import type {
  AuditEntry,
  Location,
  ReturnLine,
  ReturnOrigin,
  ReturnRequest,
  ReturnRoute,
  ReturnStatus,
} from "@/lib/types";
import type { ReturnsDataSource } from "./returns-source";
import { atBase, atBaseContent, atBaseList, parseLog, requireBackstageBase, serialiseLog } from "./backstage-base";
import { pickComplete, returnStatusMeta, statusIndex } from "@/lib/returns";

// Airtable implementation of the Returns seam. Two app-owned tables in the
// "Backstage" base (schema in README §Returns — needs creating before
// DATA_SOURCE=airtable can serve this module):
//
//  · "Return Requests" — one row per request (header). Publisher ID holds
//    the Book Clubs base Publishers record id, same convention as Hub Lines.
//  · "Return Lines"    — one row per itemised line, tied to its request via
//    the Request ID text field (same text-id linking as Hub Lines' sources).
//
// The RA attachment is stored as a real Airtable attachment field on the
// request ("RA Attachment"); the app records the filename alongside so the
// UI can label it without another fetch.

const REQUESTS = "Return Requests";
const LINES = "Return Lines";
const RA_ATTACHMENT_FIELD = "RA Attachment";

const STATUS_TO: Record<ReturnStatus, string> = {
  requested: "Requested",
  awaiting: "Awaiting Approval",
  approved: "Approved",
  shipped: "Shipped",
  credit: "Credit Confirmed",
};
const STATUS_FROM = (v: unknown): ReturnStatus =>
  (Object.entries(STATUS_TO).find(([, label]) => label === v)?.[0] as ReturnStatus) ?? "requested";

const ROUTE_TO: Record<Exclude<ReturnRoute, "">, string> = {
  direct: "Direct to Publisher",
  gardners: "Via Gardners",
};
const ROUTE_FROM = (v: unknown): ReturnRoute =>
  v === "Direct to Publisher" ? "direct" : v === "Via Gardners" ? "gardners" : "";

const toLineRecord = (r: any): ReturnLine & { requestId: string } => {
  const f = r.fields ?? {};
  return {
    id: r.id,
    requestId: f["Request ID"] ?? "",
    title: f["Title"] ?? "",
    isbn: f["ISBN"] ?? "",
    quantity: Number(f["Quantity"] ?? 0),
    reason: f["Reason"] ?? "",
    condition: f["Condition"] ?? "",
    rrp: f["RRP"] != null ? Number(f["RRP"]) : null,
    picked: Number(f["Picked"] ?? 0),
  };
};

const toRequest = (r: any, lines: ReturnLine[]): ReturnRequest => {
  const f = r.fields ?? {};
  return {
    id: r.id,
    code: f["Code"] ?? "",
    location: (f["Location"] as Location) ?? "Simply Books",
    origin: (f["Origin"] === "Event" ? "event" : "general") as ReturnOrigin,
    eventRef: f["Event Ref"] ?? "",
    eventId: f["Event ID"] || null,
    verifiedBy: f["Verified By"] ?? "",
    publisherId: f["Publisher ID"] || null,
    route: ROUTE_FROM(f["Route"]),
    status: STATUS_FROM(f["Status"]),
    raNumber: f["RA Number"] ?? "",
    raFilename: f["RA Filename"] ?? (f["RA Attachment"]?.[0]?.filename ?? ""),
    requestedBy: f["Requested By"] ?? "",
    dateRequested: f["Date Requested"] ?? "",
    dateSubmitted: f["Date Submitted"] || null,
    dateApproved: f["Date Approved"] || null,
    dateShipped: f["Date Shipped"] || null,
    dateCreditConfirmed: f["Date Credit Confirmed"] || null,
    creditAmount: f["Credit Amount"] != null ? Number(f["Credit Amount"]) : null,
    notes: f["Notes"] ?? "",
    lines,
    log: parseLog(f["Log"]),
  };
};

async function base(): Promise<string> {
  return requireBackstageBase("Returns");
}

const entry = (by: string, action: string): AuditEntry => ({ at: new Date().toISOString(), by, action });
const today = () => new Date().toISOString().slice(0, 10);

async function listAll(baseId: string): Promise<ReturnRequest[]> {
  const [reqRows, lineRows] = await Promise.all([atBaseList(baseId, REQUESTS), atBaseList(baseId, LINES)]);
  const linesByReq = new Map<string, ReturnLine[]>();
  for (const row of lineRows) {
    const l = toLineRecord(row);
    linesByReq.set(l.requestId, [...(linesByReq.get(l.requestId) ?? []), l]);
  }
  return reqRows
    .map((r) => toRequest(r, linesByReq.get(r.id) ?? []))
    .sort((a, b) => (a.dateRequested < b.dateRequested ? 1 : -1));
}

async function getOne(baseId: string, id: string): Promise<ReturnRequest> {
  const [r, lineRows] = await Promise.all([
    atBase(baseId, `${encodeURIComponent(REQUESTS)}/${id}`),
    atBaseList(baseId, LINES, { filterByFormula: `{Request ID} = "${id}"` }),
  ]);
  return toRequest(r, lineRows.map(toLineRecord));
}

async function patchRequest(
  baseId: string,
  r: ReturnRequest,
  fields: Record<string, unknown>,
  logEntry: AuditEntry | null
): Promise<ReturnRequest> {
  const patched = await atBase(baseId, `${encodeURIComponent(REQUESTS)}/${r.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: logEntry ? { ...fields, Log: serialiseLog([...r.log, logEntry]) } : fields,
    }),
  });
  return toRequest(patched, r.lines);
}

export const airtableReturnsDataSource: ReturnsDataSource = {
  async listReturns() {
    return listAll(await base());
  },
  async getReturn(id) {
    try {
      return await getOne(await base(), id);
    } catch {
      return null;
    }
  },

  async uploadApproval(id, file) {
    const baseId = await base();
    await getOne(baseId, id);
    await atBaseContent(
      baseId,
      `${encodeURIComponent(REQUESTS)}/${id}/${encodeURIComponent(RA_ATTACHMENT_FIELD)}/uploadAttachment`,
      file
    );
    const current = await getOne(baseId, id);
    return patchRequest(baseId, current, { "RA Filename": file.filename }, entry("System", `Approval form uploaded (${file.filename})`));
  },

  async createRequests(inputs, byName) {
    const baseId = await base();
    // Next code from the highest existing — RTN-0001 upwards.
    const existing = await atBaseList(baseId, REQUESTS, { "fields[]": "Code" });
    let next =
      existing.reduce((max, r) => {
        const m = /^RTN-(\d+)$/.exec(String(r.fields?.["Code"] ?? ""));
        return m ? Math.max(max, Number(m[1])) : max;
      }, 0) + 1;

    const out: ReturnRequest[] = [];
    for (const input of inputs) {
      const log: AuditEntry[] = [entry(byName, "Return request created")];
      if (input.origin === "event" && input.verifiedBy) log.push(entry(input.verifiedBy, "Event stock verified"));
      const created = await atBase(baseId, encodeURIComponent(REQUESTS), {
        method: "POST",
        body: JSON.stringify({
          fields: {
            Code: `RTN-${String(next++).padStart(4, "0")}`,
            Location: input.location,
            Origin: input.origin === "event" ? "Event" : "General Stock",
            "Event Ref": input.eventRef,
            "Event ID": input.eventId ?? "",
            "Verified By": input.verifiedBy,
            "Publisher ID": input.publisherId ?? "",
            Status: STATUS_TO.requested,
            "Requested By": byName,
            "Date Requested": today(),
            Notes: input.notes,
            Log: serialiseLog(log),
          },
        }),
      });
      const lineRecords = input.lines.map((l) => ({
        fields: {
          "Request ID": created.id,
          Title: l.title,
          ISBN: l.isbn,
          Quantity: l.quantity,
          Reason: l.reason,
          Condition: l.condition,
          RRP: l.rrp,
          Picked: 0,
        },
      }));
      const lines: ReturnLine[] = [];
      // Airtable caps batch creates at 10 records.
      for (let i = 0; i < lineRecords.length; i += 10) {
        const data = await atBase(baseId, encodeURIComponent(LINES), {
          method: "POST",
          body: JSON.stringify({ records: lineRecords.slice(i, i + 10) }),
        });
        lines.push(...data.records.map(toLineRecord));
      }
      out.push(toRequest(created, lines));
    }
    return out;
  },

  async setRoute(id, route, byName) {
    const baseId = await base();
    const r = await getOne(baseId, id);
    if (r.status !== "requested") throw new Error("Route can only change before submission");
    void byName;
    return patchRequest(baseId, r, { Route: ROUTE_TO[route] }, null);
  },

  async discard(id, byName) {
    const baseId = await base();
    const r = await getOne(baseId, id);
    if (r.status !== "requested") throw new Error("Only un-submitted requests can be discarded");
    void byName;
    // Lines first so a failure never orphans them silently.
    for (const l of r.lines) {
      await atBase(baseId, `${encodeURIComponent(LINES)}/${l.id}`, { method: "DELETE" });
    }
    await atBase(baseId, `${encodeURIComponent(REQUESTS)}/${id}`, { method: "DELETE" });
  },

  async submit(id, byName) {
    const baseId = await base();
    const r = await getOne(baseId, id);
    if (r.status !== "requested") throw new Error("Already submitted");
    if (!r.route) throw new Error("Choose a return route first");
    return patchRequest(
      baseId,
      r,
      { Status: STATUS_TO.awaiting, "Date Submitted": today() },
      entry(byName, "Submitted for approval")
    );
  },

  async approve(id, raNumber, raFilename, byName) {
    const baseId = await base();
    const r = await getOne(baseId, id);
    if (r.status !== "awaiting") throw new Error("Submit the request before approving");
    if (!raNumber.trim()) throw new Error("Enter the RA number");
    return patchRequest(
      baseId,
      r,
      {
        Status: STATUS_TO.approved,
        "RA Number": raNumber.trim(),
        "RA Filename": raFilename,
        "Date Approved": today(),
      },
      entry(byName, `RA received — approved (${raNumber.trim()})`)
    );
  },

  async pick(id, lineId, count, byName) {
    const baseId = await base();
    const r = await getOne(baseId, id);
    if (r.status !== "approved") throw new Error("Picking opens once the return is approved");
    const line = r.lines.find((l) => l.id === lineId);
    if (!line) throw new Error("Line not found");
    if (line.picked >= line.quantity) throw new Error("All copies of that title already picked");
    void byName;
    const picked = Math.min(line.quantity, line.picked + Math.max(1, Math.floor(count)));
    await atBase(baseId, `${encodeURIComponent(LINES)}/${lineId}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: { Picked: picked } }),
    });
    line.picked = picked;
    return r;
  },

  async confirmShipped(id, byName) {
    const baseId = await base();
    const r = await getOne(baseId, id);
    if (r.status !== "approved") throw new Error("Approve the return before shipping");
    if (!pickComplete(r)) throw new Error("Scan every copy before shipping");
    return patchRequest(
      baseId,
      r,
      { Status: STATUS_TO.shipped, "Date Shipped": today() },
      entry(byName, "Parcel shipped")
    );
  },

  async confirmCredit(id, amount, byName) {
    const baseId = await base();
    const r = await getOne(baseId, id);
    if (r.status !== "shipped") throw new Error("Ship the return before confirming credit");
    const credit = amount != null && amount > 0 ? amount : r.creditAmount;
    return patchRequest(
      baseId,
      r,
      {
        Status: STATUS_TO.credit,
        "Date Credit Confirmed": today(),
        ...(credit != null ? { "Credit Amount": credit } : {}),
      },
      entry(byName, `Credit confirmed${credit ? ` · £${credit.toFixed(2)}` : ""}`)
    );
  },

  async revert(id, to, byName) {
    const baseId = await base();
    const r = await getOne(baseId, id);
    const toIdx = statusIndex(to);
    if (toIdx < 0 || toIdx >= statusIndex(r.status)) throw new Error("Can only move back to an earlier stage");
    const fields: Record<string, unknown> = { Status: STATUS_TO[to] };
    if (toIdx < 1) fields["Date Submitted"] = null;
    if (toIdx < 2) {
      fields["Date Approved"] = null;
      fields["RA Number"] = "";
      fields["RA Filename"] = "";
    }
    if (toIdx < 3) {
      fields["Date Shipped"] = null;
      for (const l of r.lines) {
        if (l.picked > 0) {
          await atBase(baseId, `${encodeURIComponent(LINES)}/${l.id}`, {
            method: "PATCH",
            body: JSON.stringify({ fields: { Picked: 0 } }),
          });
          l.picked = 0;
        }
      }
    }
    if (toIdx < 4) {
      fields["Date Credit Confirmed"] = null;
      fields["Credit Amount"] = null;
    }
    return patchRequest(baseId, r, fields, entry(byName, `Reverted to ${returnStatusMeta(to).label}`));
  },
};
