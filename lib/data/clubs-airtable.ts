import type {
  AuditEntry,
  BookSelection,
  Club,
  ClubMembership,
  Location,
  Member,
  MembershipStatus,
  PaymentRecord,
  PayStatus,
} from "@/lib/types";
import type { ClubsDataSource } from "./clubs-source";
import { atBase, atBaseList, parseLog, requireBookClubsBase, serialiseLog } from "./backstage-base";
import { nthWeekdayDate, prettyCadence } from "@/lib/clubs";
import * as stripe from "@/lib/stripe";

// Airtable + Stripe implementation of the Book Clubs seam, mapped onto the
// LIVE "Book Clubs" base (in daily use since Oct 2024 — treat with care):
//
//   · "Book Clubs"  — the clubs themselves. Their Week/Day/Time trio is the
//     monthly cadence ("Nth weekday"); Location was added Jul 2026 and
//     BLANK MEANS SIMPLY BOOKS (every club predates Prologue). The default
//     Todo/In-progress/Done Status carries no meaning and is ignored.
//   · "Members"     — a Stripe subscription sync: ONE ROW PER SUBSCRIPTION,
//     not per person. The app derives people by grouping on Customer ID.
//     The sync owns most fields; the app writes only the action fields
//     (Status / Cancelled membership / links) plus its own "Backstage Log".
//   · "Book Orders" — the existing monthly ordering flow ≈ Book Selections.
//     "Hub Line ID" (added Jul 2026) links each pick to the central Hub
//     Lines queue in the Backstage base; the hub writes Status back here
//     (Publisher Contacted on send, Received on arrival) so the team's
//     existing views keep working.
//
// Stripe writes go through lib/stripe.ts FIRST, then the record is updated,
// so Airtable can never claim a write Stripe refused.

const T = { clubs: "Book Clubs", members: "Members", orders: "Book Orders" };

// The team's practice: members join via a per-club Stripe payment link, so
// clubs don't store a price id — it's derived from an existing member's Plan
// when the move flow needs one.

interface RawMembership extends ClubMembership {
  /** Product select value — fallback club matcher when the link is empty. */
  productName: string;
}

// Short server-side cache: /api/clubs, /api/hub and /api/nav-counts all read
// these lists; Airtable allows 5 req/s/base.
const listCache = new Map<string, { at: number; rows: any[] }>();
const LIST_CACHE_MS = 30_000;

async function cachedList(baseId: string, table: string): Promise<any[]> {
  const hit = listCache.get(table);
  if (hit && Date.now() - hit.at < LIST_CACHE_MS) return hit.rows;
  const rows = await atBaseList(baseId, table);
  listCache.set(table, { at: Date.now(), rows });
  return rows;
}

function invalidate(table?: string) {
  if (table) listCache.delete(table);
  else listCache.clear();
}

const entry = (by: string, action: string): AuditEntry => ({ at: new Date().toISOString(), by, action });

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

const toClub = (r: any): Club => {
  const f = r.fields ?? {};
  return {
    id: r.id,
    name: String(f["Name"] ?? "").trim(),
    kind: "book-club",
    location: (f["Location"] as Location) || "Simply Books", // blank = Simply Books
    description: f["Notes"] ?? "",
    genre: f["Focus"] || f["Book Club Type"] || "",
    cadence: prettyCadence(f["Session Time"] ?? ""),
    stripePriceId: "", // derived from members' Plan when needed (payment-link model)
    status: "active", // the base's Status field is the untouched Airtable default — meaningless
  };
};

/** Stable person key: Stripe customer id, else email, else the row id. */
const personKey = (f: any, recordId: string): string =>
  String(f["Customer ID"] ?? "").trim() || String(f["Customer Email"] ?? "").trim().toLowerCase() || recordId;

function toMemberships(rows: any[], clubs: Club[]): RawMembership[] {
  const clubByName = new Map(clubs.map((c) => [c.name.toLowerCase(), c.id]));
  return rows.map((r) => {
    const f = r.fields ?? {};
    const stripeStatus = String(f["Status"]?.name ?? f["Status"] ?? "").toLowerCase();
    const cancelled = !!f["Cancelled membership"] || stripeStatus === "canceled" || stripeStatus === "incomplete_expired";
    const status: MembershipStatus = cancelled ? "cancelled" : stripeStatus === "paused" ? "paused" : "active";
    const payStatus: PayStatus =
      stripeStatus === "past_due" ? "past_due" : stripeStatus === "unpaid" || stripeStatus === "incomplete" ? "failed" : "ok";
    const productName = String(f["Product"]?.name ?? f["Product"] ?? "").trim();
    return {
      id: r.id,
      memberId: personKey(f, r.id),
      clubId: f["Book Clubs"]?.[0] ?? clubByName.get(productName.toLowerCase()) ?? "",
      stripeSubscriptionId: String(f["id"] ?? "").trim(),
      status,
      joined: String(f["Start Date (UTC)"] ?? f["Created (UTC)"] ?? r.createdTime ?? "").slice(0, 10),
      payStatus,
      cardLabel: "", // not held in the sync
      periodEnd: String(f["Current Period End (UTC)"] ?? "").slice(0, 10),
      amount: Number(f["Amount"] ?? 0),
      log: parseLog(f["Backstage Log"]),
      productName,
    };
  });
}

/** People are DERIVED — one per Customer ID across their subscription rows. */
function toMembers(rows: any[]): Member[] {
  const byKey = new Map<string, Member>();
  for (const r of rows) {
    const f = r.fields ?? {};
    const key = personKey(f, r.id);
    const existing = byKey.get(key);
    const name = String(f["Customer Name"] ?? "").trim();
    const notes = String(f["Customer Description"] ?? "").trim();
    if (existing) {
      if (!existing.name && name) existing.name = name;
      if (!existing.notes && notes) existing.notes = notes;
    } else {
      byKey.set(key, {
        id: key,
        name: name || String(f["Customer Email"] ?? "").trim() || "Unknown member",
        email: String(f["Customer Email"] ?? "").trim(),
        phone: "", // not held in the Stripe sync
        address: "",
        stripeCustomerId: String(f["Customer ID"] ?? "").trim(),
        notes,
      });
    }
  }
  return [...byKey.values()];
}

const cleanIsbn = (v: unknown): string => String(v ?? "").replace(/[^0-9Xx]/g, "");

const toSelection = (r: any): BookSelection => {
  const f = r.fields ?? {};
  const required = String(f["Date Required For"] ?? "");
  return {
    id: r.id,
    clubId: f["Book Club"]?.[0] ?? "",
    month: (required || String(r.createdTime ?? "")).slice(0, 7),
    title: String(f["Name"] ?? "").trim(),
    isbn: cleanIsbn(f["ISBN"]?.text ?? f["ISBN"]),
    publisherId: f["Publisher"]?.[0] ?? null,
    imprint: "",
    rrp: null, // Book Orders doesn't hold price — the hub line does
    selectedBy: "",
    selectedAt: r.createdTime ?? "",
    hostCopy: false, // not tracked in the live flow; quantity is as entered
    quantity: Number(f["Copies Needed?"] ?? 0),
    hubLineId: f["Hub Line ID"] || null,
  };
};

async function base(): Promise<string> {
  return requireBookClubsBase("Book Clubs");
}

/** PATCH a Members row. typecast lets Status accept values the sync hasn't
 *  created as options yet (e.g. "paused"). */
async function patchMembership(
  baseId: string,
  sub: ClubMembership,
  fields: Record<string, unknown>,
  logEntry: AuditEntry
): Promise<void> {
  await atBase(baseId, `${encodeURIComponent(T.members)}/${sub.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: { ...fields, "Backstage Log": serialiseLog([...sub.log, logEntry]) },
      typecast: true,
    }),
  });
  invalidate(T.members);
}

async function getMembershipRecord(baseId: string, id: string): Promise<RawMembership> {
  const r = await atBase(baseId, `${encodeURIComponent(T.members)}/${id}`);
  const [m] = toMemberships([r], []);
  return m;
}

export const airtableClubsDataSource: ClubsDataSource = {
  async listMembers() {
    return toMembers(await cachedList(await base(), T.members));
  },
  async getMember(id) {
    return (await this.listMembers()).find((m) => m.id === id) ?? null;
  },
  async createMember() {
    // Members come from Stripe payment links via the sync — creating one
    // here would just be overwritten.
    throw new Error("Members are created by Stripe signup (payment links) — not from the app");
  },
  async updateMember(id, input) {
    // Only notes are safe-ish to edit, and even those live on sync-owned
    // rows. Deferred until the Members sync is rebuilt (Ben: "could be
    // improved/rebuilt").
    void id;
    void input;
    throw new Error("Member details are owned by the Stripe sync for now — edit in Stripe/Airtable directly");
  },

  async listClubs() {
    return (await cachedList(await base(), T.clubs)).map(toClub);
  },
  async getClub(id) {
    try {
      return toClub(await atBase(await base(), `${encodeURIComponent(T.clubs)}/${id}`));
    } catch {
      return null;
    }
  },

  async listMemberships() {
    const baseId = await base();
    const clubs = (await cachedList(baseId, T.clubs)).map(toClub);
    return toMemberships(await cachedList(baseId, T.members), clubs);
  },

  async listSelections() {
    return (await cachedList(await base(), T.orders)).map(toSelection);
  },
  async saveSelection(input, byName) {
    const baseId = await base();
    const clubRecord = await atBase(baseId, `${encodeURIComponent(T.clubs)}/${input.clubId}`);
    const cf = clubRecord.fields ?? {};
    // Session-anchored date (Ben: sessions are what a book ties to): the
    // Nth weekday of the month from the club's Week/Day pattern.
    const requiredFor = nthWeekdayDate(input.month, cf["Week"] ?? "", cf["Day"] ?? "") ?? `${input.month}-01`;
    const fields: Record<string, unknown> = {
      Name: input.title,
      ISBN: { text: input.isbn },
      "Copies Needed?": input.quantity,
      "Date Required For": requiredFor,
      "Book Club": [input.clubId],
      ...(input.publisherId ? { Publisher: [input.publisherId] } : {}),
    };
    const existing = (await cachedList(baseId, T.orders))
      .map(toSelection)
      .find((s) => s.clubId === input.clubId && s.month === input.month);
    let record;
    if (existing) {
      record = await atBase(baseId, `${encodeURIComponent(T.orders)}/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fields, typecast: true }),
      });
    } else {
      record = await atBase(baseId, encodeURIComponent(T.orders), {
        method: "POST",
        body: JSON.stringify({ fields: { ...fields, Status: "To Order" }, typecast: true }),
      });
    }
    void byName; // Book Orders has no selected-by field; the hub line logs who
    invalidate(T.orders);
    return toSelection(record);
  },
  async setSelectionHubLine(id, hubLineId) {
    await atBase(await base(), `${encodeURIComponent(T.orders)}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: { "Hub Line ID": hubLineId ?? "" } }),
    });
    invalidate(T.orders);
  },
  async updateSelectionOrderStatus(id, state) {
    // Keep the team's existing Book Orders views truthful: the hub owns the
    // canonical state; this mirrors it into their Status column.
    const status = state === "arrived" ? "Received" : "Publisher Contacted";
    await atBase(await base(), `${encodeURIComponent(T.orders)}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: { Status: status }, typecast: true }),
    });
    invalidate(T.orders);
  },

  async getPaymentHistory(memberId) {
    // The person key IS the Stripe customer id whenever the sync holds one.
    if (!memberId.startsWith("cus_") || !stripe.stripeConfigured()) return [];
    const invoices = await stripe.listInvoices(memberId);
    return invoices.map(
      (inv: any): PaymentRecord => ({
        id: inv.id,
        date: new Date((inv.created ?? 0) * 1000).toISOString().slice(0, 10),
        amount: (inv.amount_due ?? 0) / 100,
        status: inv.status === "paid" ? "succeeded" : inv.post_payment_credit_notes_amount ? "refunded" : "failed",
        description: inv.lines?.data?.[0]?.description ?? "Subscription",
      })
    );
  },

  async cancelMembership(id, when, byName) {
    const baseId = await base();
    const sub = await getMembershipRecord(baseId, id);
    if (stripe.stripeConfigured() && sub.stripeSubscriptionId) {
      await stripe.cancelSubscription(sub.stripeSubscriptionId, when);
    }
    if (when === "now") {
      await patchMembership(baseId, sub, { "Cancelled membership": true, Status: "canceled" }, entry(byName, "Cancelled immediately"));
      return { ...sub, status: "cancelled" };
    }
    // Period-end cancel: stays active until Stripe ends it (the webhook /
    // sync will flip the row then).
    await patchMembership(baseId, sub, { "Cancel At Period End": "true" }, entry(byName, `Cancelled at period end (${sub.periodEnd})`));
    return sub;
  },
  async pauseMembership(id, byName) {
    const baseId = await base();
    const sub = await getMembershipRecord(baseId, id);
    if (stripe.stripeConfigured() && sub.stripeSubscriptionId) {
      await stripe.pauseSubscription(sub.stripeSubscriptionId);
    }
    await patchMembership(baseId, sub, { Status: "paused" }, entry(byName, "Paused (Stripe subscription pause)"));
    return { ...sub, status: "paused" };
  },
  async resumeMembership(id, byName) {
    const baseId = await base();
    const sub = await getMembershipRecord(baseId, id);
    if (stripe.stripeConfigured() && sub.stripeSubscriptionId) {
      await stripe.resumeSubscription(sub.stripeSubscriptionId);
    }
    await patchMembership(baseId, sub, { Status: "active" }, entry(byName, "Resumed"));
    return { ...sub, status: "active" };
  },
  async moveMembership(id, targetClubId, byName) {
    const baseId = await base();
    const sub = await getMembershipRecord(baseId, id);
    const [memberships, target, from] = await Promise.all([
      this.listMemberships(),
      this.getClub(targetClubId),
      this.getClub(sub.clubId),
    ]);
    if (!target) throw new Error("Target club not found");
    // Clubs are joined via per-club payment links, so the club's price id is
    // derived from an existing member's Plan.
    const donor = memberships.find(
      (m) => m.clubId === targetClubId && (m as RawMembership).productName && m.status === "active"
    ) as RawMembership | undefined;
    const targetPrice = await (async () => {
      const rows = await cachedList(baseId, T.members);
      const row = rows.find((r) => r.id === donor?.id);
      return String(row?.fields?.["Plan"]?.name ?? row?.fields?.["Plan"] ?? "").trim();
    })();
    let newSubId = sub.stripeSubscriptionId;
    if (stripe.stripeConfigured() && sub.stripeSubscriptionId) {
      const customerRow = (await cachedList(baseId, T.members)).find((r) => r.id === sub.id);
      const customerId = String(customerRow?.fields?.["Customer ID"] ?? "");
      if (!targetPrice.startsWith("price_")) {
        throw new Error(`No Stripe price known for ${target.name} yet — move this member in Stripe directly`);
      }
      if (!customerId.startsWith("cus_")) throw new Error("No Stripe customer id on this membership");
      newSubId = await stripe.moveSubscription(sub.stripeSubscriptionId, customerId, targetPrice);
    }
    await patchMembership(
      baseId,
      sub,
      {
        "Book Clubs": [targetClubId],
        ...(target.name ? { Product: target.name } : {}),
        ...(targetPrice ? { Plan: targetPrice } : {}),
        id: newSubId,
        Status: "active",
      },
      entry(byName, `Moved from ${from?.name ?? "?"} to ${target.name} (old sub cancelled, new sub created)`)
    );
    return { ...sub, clubId: targetClubId, stripeSubscriptionId: newSubId, status: "active" };
  },

  async applyStripeEvent(evt) {
    const baseId = await base();
    const rows = await atBaseList(baseId, T.members, {
      filterByFormula: `{id} = "${evt.subscriptionId}"`,
      maxRecords: "1",
    });
    if (!rows[0]) return;
    const [sub] = toMemberships([rows[0]], []);
    const fields: Record<string, unknown> = {};
    if (evt.status === "cancelled") fields["Cancelled membership"] = true;
    if (evt.status) fields["Status"] = evt.status === "cancelled" ? "canceled" : evt.status === "paused" ? "paused" : "active";
    if (evt.payStatus === "past_due") fields["Status"] = "past_due";
    if (evt.periodEnd) fields["Current Period End (UTC)"] = evt.periodEnd;
    await patchMembership(baseId, sub, fields, entry("Stripe webhook", evt.type));
  },
};
