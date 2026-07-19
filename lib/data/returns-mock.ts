import type { AuditEntry, ReturnLine, ReturnRequest, ReturnStatus } from "@/lib/types";
import type { ReturnsDataSource } from "./returns-source";
import { pickComplete, returnStatusMeta, statusIndex } from "@/lib/returns";

// In-memory Returns store — same rules as hub-mock. Seed mirrors the design
// file's dataset: a queue spread across both shops, both origins and every
// lifecycle stage, with publisher ids matching hub-mock's PUBLISHER_SEED so
// account numbers and discount rates resolve.

const daysAgo = (d: number) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
const entry = (by: string, action: string): AuditEntry => ({ at: new Date().toISOString(), by, action });

interface SeedLine {
  title: string;
  isbn: string;
  quantity: number;
  reason: string;
  condition: string;
  rrp: number | null;
  picked?: number;
}

interface Seed {
  code: string;
  location: ReturnRequest["location"];
  origin: ReturnRequest["origin"];
  eventRef?: string;
  verifiedBy?: string;
  publisherId: string;
  route: ReturnRequest["route"];
  status: ReturnStatus;
  raNumber?: string;
  raFilename?: string;
  requestedBy: string;
  daysReq: number;
  daysSub?: number;
  daysApp?: number;
  daysShip?: number;
  daysCred?: number;
  creditAmount?: number;
  notes?: string;
  lines: SeedLine[];
}

const SEED: Seed[] = [
  {
    code: "RTN-0142", location: "Prologue", origin: "general", publisherId: "pubFaber", route: "", status: "requested",
    requestedBy: "Priya Nair", daysReq: 1,
    lines: [
      { title: "Intermezzo", isbn: "9780571391110", quantity: 3, reason: "slow-moving", condition: "new", rrp: 20 },
      { title: "Caledonian Road", isbn: "9781399813204", quantity: 2, reason: "slow-moving", condition: "shelf-worn", rrp: 20 },
    ],
  },
  {
    code: "RTN-0143", location: "Prologue", origin: "event", eventRef: "Paul Murray in conversation", verifiedBy: "Ben",
    publisherId: "pubPRH", route: "", status: "requested", requestedBy: "Events reconciliation", daysReq: 2,
    notes: "Unsold from launch night — verified on the shop-floor count.",
    lines: [
      { title: "The Bee Sting", isbn: "9780241347355", quantity: 12, reason: "event-unsold", condition: "new", rrp: 20 },
      { title: "Orbital", isbn: "9781529922936", quantity: 5, reason: "event-unsold", condition: "new", rrp: 14.99 },
    ],
  },
  {
    code: "RTN-0144", location: "Simply Books", origin: "general", publisherId: "pubHarper", route: "", status: "requested",
    requestedBy: "Grace", daysReq: 3, notes: "Water damage — bottom shelf leak.",
    lines: [{ title: "Wild Houses", isbn: "9780008626433", quantity: 4, reason: "damaged", condition: "damaged", rrp: 16.99 }],
  },
  {
    code: "RTN-0139", location: "Prologue", origin: "general", publisherId: "pubPRH", route: "direct", status: "awaiting",
    requestedBy: "Ben", daysReq: 5, daysSub: 5,
    lines: [{ title: "The Wren, The Wren", isbn: "9781787334298", quantity: 6, reason: "slow-moving", condition: "new", rrp: 18.99 }],
  },
  {
    code: "RTN-0137", location: "Simply Books", origin: "general", publisherId: "pubPanMac", route: "gardners", status: "awaiting",
    requestedBy: "Lynsey", daysReq: 14, daysSub: 13, notes: "Chased Gardners portal — no authorisation back yet.",
    lines: [
      { title: "James", isbn: "9781035031245", quantity: 3, reason: "overstock", condition: "new", rrp: 18.99 },
      { title: "The Ministry of Time", isbn: "9781399726368", quantity: 2, reason: "slow-moving", condition: "new", rrp: 16.99 },
    ],
  },
  {
    code: "RTN-0135", location: "Prologue", origin: "event", eventRef: "Sarah Perry evening", verifiedBy: "Ben",
    publisherId: "pubBloomsbury", route: "direct", status: "awaiting", requestedBy: "Events reconciliation",
    daysReq: 21, daysSub: 20,
    lines: [{ title: "Held", isbn: "9781526666246", quantity: 8, reason: "event-unsold", condition: "new", rrp: 18.99 }],
  },
  {
    code: "RTN-0131", location: "Prologue", origin: "general", publisherId: "pubFaber", route: "direct", status: "approved",
    raNumber: "FAB-RA-77213", raFilename: "RA-form-RTN-0131.pdf", requestedBy: "Ben", daysReq: 18, daysSub: 17, daysApp: 11,
    lines: [
      { title: "Intermezzo", isbn: "9780571391110", quantity: 5, reason: "slow-moving", condition: "new", rrp: 20, picked: 2 },
      { title: "Caledonian Road", isbn: "9781399813204", quantity: 3, reason: "slow-moving", condition: "shelf-worn", rrp: 20 },
    ],
  },
  {
    code: "RTN-0129", location: "Simply Books", origin: "general", publisherId: "pubCanongate", route: "gardners", status: "approved",
    raNumber: "GDN-2026-4471", raFilename: "RA-form-RTN-0129.pdf", requestedBy: "Grace", daysReq: 24, daysSub: 23, daysApp: 16,
    notes: "Gardners consolidated return — box ref 7742.",
    lines: [{ title: "Nexus", isbn: "9781529931790", quantity: 4, reason: "overstock", condition: "new", rrp: 25 }],
  },
  {
    code: "RTN-0124", location: "Prologue", origin: "general", publisherId: "pubPRH", route: "direct", status: "shipped",
    raNumber: "PRH-RA-9981", raFilename: "RA-form-RTN-0124.pdf", requestedBy: "Ben", daysReq: 39, daysSub: 38, daysApp: 33, daysShip: 29,
    lines: [{ title: "Enlightenment", isbn: "9781787334618", quantity: 6, reason: "slow-moving", condition: "new", rrp: 18.99, picked: 6 }],
  },
  {
    code: "RTN-0121", location: "Simply Books", origin: "event", eventRef: "Stockport Lit crawl", verifiedBy: "Lynsey",
    publisherId: "pubBloomsbury", route: "gardners", status: "shipped", raNumber: "GDN-2026-4390",
    raFilename: "RA-form-RTN-0121.pdf", requestedBy: "Events reconciliation", daysReq: 47, daysSub: 46, daysApp: 40, daysShip: 37,
    lines: [{ title: "Held", isbn: "9781526666246", quantity: 9, reason: "event-unsold", condition: "shelf-worn", rrp: 18.99, picked: 9 }],
  },
  {
    code: "RTN-0118", location: "Prologue", origin: "general", publisherId: "pubHarper", route: "direct", status: "credit",
    raNumber: "HC-RA-5540", raFilename: "RA-form-RTN-0118.pdf", requestedBy: "Ben", daysReq: 60, daysSub: 59, daysApp: 53,
    daysShip: 50, daysCred: 35, creditAmount: 186.24,
    lines: [{ title: "Wild Houses", isbn: "9780008626433", quantity: 12, reason: "slow-moving", condition: "new", rrp: 16.99, picked: 12 }],
  },
  {
    code: "RTN-0110", location: "Simply Books", origin: "general", publisherId: "pubPanMac", route: "gardners", status: "credit",
    raNumber: "GDN-2026-4120", raFilename: "RA-form-RTN-0110.pdf", requestedBy: "Grace", daysReq: 75, daysSub: 74, daysApp: 68,
    daysShip: 65, daysCred: 51, creditAmount: 51.27,
    lines: [{ title: "James", isbn: "9781035031245", quantity: 5, reason: "overstock", condition: "new", rrp: 18.99, picked: 5 }],
  },
];

let idN = 0;

function seedRequest(s: Seed): ReturnRequest {
  const lines: ReturnLine[] = s.lines.map((l) => ({
    id: `rl${++idN}`,
    title: l.title,
    isbn: l.isbn,
    quantity: l.quantity,
    reason: l.reason,
    condition: l.condition,
    rrp: l.rrp,
    picked: l.picked ?? 0,
  }));
  const idx = statusIndex(s.status);
  const at = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
  const log: AuditEntry[] = [{ at: at(s.daysReq), by: s.requestedBy, action: "Return request created" }];
  if (s.verifiedBy) log.push({ at: at(s.daysReq), by: s.verifiedBy, action: "Event stock verified" });
  if (idx >= 1 && s.daysSub != null) log.push({ at: at(s.daysSub), by: s.requestedBy === "Events reconciliation" ? "Ben" : s.requestedBy, action: "Submitted for approval" });
  if (idx >= 2 && s.daysApp != null) log.push({ at: at(s.daysApp), by: "Ben", action: `RA received — approved (${s.raNumber})` });
  if (idx >= 3 && s.daysShip != null) log.push({ at: at(s.daysShip), by: "Ben", action: "Parcel shipped" });
  if (idx >= 4 && s.daysCred != null) log.push({ at: at(s.daysCred), by: "Ben", action: `Credit confirmed${s.creditAmount ? ` · £${s.creditAmount.toFixed(2)}` : ""}` });
  return {
    id: `rtn${++idN}`,
    code: s.code,
    location: s.location,
    origin: s.origin,
    eventRef: s.eventRef ?? "",
    eventId: null,
    verifiedBy: s.verifiedBy ?? "",
    publisherId: s.publisherId,
    route: s.route,
    status: s.status,
    raNumber: s.raNumber ?? "",
    raFilename: s.raFilename ?? "",
    requestedBy: s.requestedBy,
    dateRequested: daysAgo(s.daysReq),
    dateSubmitted: s.daysSub != null ? daysAgo(s.daysSub) : null,
    dateApproved: s.daysApp != null ? daysAgo(s.daysApp) : null,
    dateShipped: s.daysShip != null ? daysAgo(s.daysShip) : null,
    dateCreditConfirmed: s.daysCred != null ? daysAgo(s.daysCred) : null,
    creditAmount: s.creditAmount ?? null,
    notes: s.notes ?? "",
    lines,
    log,
  };
}

interface Store {
  requests: ReturnRequest[];
  nextCode: number;
}

function seed(): Store {
  const requests = SEED.map(seedRequest);
  return { requests, nextCode: 145 };
}

const g = globalThis as typeof globalThis & { __returnsStore?: Store };
const store = (): Store => (g.__returnsStore ??= seed());

function get(id: string): ReturnRequest {
  const r = store().requests.find((x) => x.id === id);
  if (!r) throw new Error("Return not found");
  return r;
}

const today = () => new Date().toISOString().slice(0, 10);

export const mockReturnsDataSource: ReturnsDataSource = {
  async listReturns() {
    return store().requests;
  },
  async getReturn(id) {
    return store().requests.find((r) => r.id === id) ?? null;
  },

  async createRequests(inputs, byName) {
    const s = store();
    const created = inputs.map((input) => {
      const r: ReturnRequest = {
        id: `rtn${++idN}`,
        code: `RTN-${String(s.nextCode++).padStart(4, "0")}`,
        location: input.location,
        origin: input.origin,
        eventRef: input.eventRef,
        eventId: input.eventId,
        verifiedBy: input.verifiedBy,
        publisherId: input.publisherId,
        route: "",
        status: "requested",
        raNumber: "",
        raFilename: "",
        requestedBy: byName,
        dateRequested: today(),
        dateSubmitted: null,
        dateApproved: null,
        dateShipped: null,
        dateCreditConfirmed: null,
        creditAmount: null,
        notes: input.notes,
        lines: input.lines.map((l) => ({ ...l, id: `rl${++idN}`, picked: 0 })),
        log: [entry(byName, "Return request created")],
      };
      if (input.origin === "event" && input.verifiedBy) {
        r.log.push(entry(input.verifiedBy, "Event stock verified"));
      }
      s.requests.unshift(r);
      return r;
    });
    return created;
  },

  async setRoute(id, route, byName) {
    const r = get(id);
    if (r.status !== "requested") throw new Error("Route can only change before submission");
    r.route = route;
    void byName; // route choice is a draft edit — logged at submission
    return r;
  },

  async discard(id, byName) {
    const s = store();
    const r = get(id);
    if (r.status !== "requested") throw new Error("Only un-submitted requests can be discarded");
    void byName;
    s.requests = s.requests.filter((x) => x.id !== id);
  },

  async submit(id, byName) {
    const r = get(id);
    if (r.status !== "requested") throw new Error("Already submitted");
    if (!r.route) throw new Error("Choose a return route first");
    r.status = "awaiting";
    r.dateSubmitted = today();
    r.log.push(entry(byName, "Submitted for approval"));
    return r;
  },

  async approve(id, raNumber, raFilename, byName) {
    const r = get(id);
    if (r.status !== "awaiting") throw new Error("Submit the request before approving");
    if (!raNumber.trim()) throw new Error("Enter the RA number");
    r.status = "approved";
    r.raNumber = raNumber.trim();
    r.raFilename = raFilename;
    r.dateApproved = today();
    r.log.push(entry(byName, `RA received — approved (${r.raNumber})`));
    return r;
  },

  async pick(id, lineId, byName) {
    const r = get(id);
    if (r.status !== "approved") throw new Error("Picking opens once the return is approved");
    const line = r.lines.find((l) => l.id === lineId);
    if (!line) throw new Error("Line not found");
    if (line.picked >= line.quantity) throw new Error("All copies of that title already picked");
    line.picked++;
    void byName; // individual scans aren't audit entries — shipping is
    return r;
  },

  async confirmShipped(id, byName) {
    const r = get(id);
    if (r.status !== "approved") throw new Error("Approve the return before shipping");
    if (!pickComplete(r)) throw new Error("Scan every copy before shipping");
    r.status = "shipped";
    r.dateShipped = today();
    r.log.push(entry(byName, "Parcel shipped"));
    return r;
  },

  async confirmCredit(id, amount, byName) {
    const r = get(id);
    if (r.status !== "shipped") throw new Error("Ship the return before confirming credit");
    r.status = "credit";
    r.dateCreditConfirmed = today();
    if (amount != null && amount > 0) r.creditAmount = amount;
    r.log.push(entry(byName, `Credit confirmed${r.creditAmount ? ` · £${r.creditAmount.toFixed(2)}` : ""}`));
    return r;
  },

  async revert(id, to, byName) {
    const r = get(id);
    const toIdx = statusIndex(to);
    if (toIdx < 0 || toIdx >= statusIndex(r.status)) throw new Error("Can only move back to an earlier stage");
    if (toIdx < 1) r.dateSubmitted = null;
    if (toIdx < 2) {
      r.dateApproved = null;
      r.raNumber = "";
      r.raFilename = "";
    }
    if (toIdx < 3) {
      r.dateShipped = null;
      for (const l of r.lines) l.picked = 0;
    }
    if (toIdx < 4) {
      r.dateCreditConfirmed = null;
      r.creditAmount = null;
    }
    r.status = to;
    r.log.push(entry(byName, `Reverted to ${returnStatusMeta(to).label}`));
    return r;
  },
};
