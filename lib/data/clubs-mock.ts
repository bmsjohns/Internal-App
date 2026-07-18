import type {
  AuditEntry,
  BookSelection,
  BookSelectionInput,
  Club,
  ClubMembership,
  Member,
  MemberInput,
  PaymentRecord,
} from "@/lib/types";
import type { ClubsDataSource } from "./clubs-source";
import { currentMonthKey, recentMonthKeys } from "@/lib/clubs";

// In-memory Book Clubs store for development/tests — no Airtable, no Stripe.
// Seeded DETERMINISTICALLY (fixed PRNG seed) so lists render identically
// across restarts and tests can assert on counts. Same globalThis pattern as
// lib/data/mock.ts so every route bundle shares one instance.

// mulberry32 — tiny deterministic PRNG.
function prng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Amara", "Jonah", "Priya", "Rowan", "Nadia", "Callum", "Sofia", "Ellis", "Maya", "Theo", "Isla", "Dev", "Grace", "Omar", "Freya", "Marcus", "Leila", "Sam", "Hana", "Owen", "Zara", "Noah", "Ivy", "Rafi", "Bea", "Yusuf", "Cora", "Finn", "Aisha", "Luca", "Mabel", "Josh", "Neve", "Kian", "Elsie"];
const LAST = ["Okafor", "Mercer", "Nair", "Wells", "Haq", "Doyle", "Rossi", "Grant", "Lund", "Barnes", "Frost", "Shah", "Owusu", "Ali", "Nyberg", "Reed", "Karim", "Cole", "Park", "Boyd", "Malik", "Webb", "Quinn", "Aziz", "Hart", "Demir", "Lane", "Kerr", "Rahman", "Conti", "Fry", "Bell", "Voss", "Kaur"];
const NOTES = [
  "Prefers hardbacks. Coeliac — flag for supper events.",
  "Long-standing member since launch. Brings a friend most months.",
  "Reduced-fee concession. Reviewed annually.",
  "New this quarter. Found us via the Weir Mill launch.",
  "Also on the events mailing list. Volunteers at fairs.",
  "Asked to skip December — travelling.",
  "",
  "",
];

const CLUB_SEED: Omit<Club, "kind">[] = [
  { id: "clb1", name: "First Chapter Club", location: "Prologue", description: "", genre: "Literary Fiction", cadence: "First Tuesday · monthly", stripePriceId: "price_1LaQ", status: "active", memberCapacity: 14 },
  { id: "clb2", name: "Killer Lines", location: "Prologue", description: "", genre: "Crime & Thriller", cadence: "Second Thursday · monthly", stripePriceId: "price_1LbR", status: "active", memberCapacity: 12 },
  { id: "clb3", name: "Book & Bottle", location: "Prologue", description: "", genre: "Contemporary", cadence: "Last Friday · monthly", stripePriceId: "price_1LcS", status: "active", memberCapacity: 15 },
  // Deliberately unset — demonstrates the "no capacity set" fallback.
  { id: "clb4", name: "Far Horizons SFF", location: "Prologue", description: "", genre: "Sci-Fi & Fantasy", cadence: "Third Wednesday · monthly", stripePriceId: "price_1LdT", status: "active", memberCapacity: null },
  { id: "clb5", name: "The Non-Fiction Table", location: "Prologue", description: "", genre: "Non-fiction", cadence: "First Monday · monthly", stripePriceId: "price_1LeU", status: "active", memberCapacity: 13 },
  { id: "clb6", name: "Verse & Voice", location: "Prologue", description: "", genre: "Poetry", cadence: "Fortnightly · Sundays", stripePriceId: "price_1LfV", status: "active", memberCapacity: 10 },
  { id: "clb7", name: "Translated Fiction", location: "Prologue", description: "", genre: "Translated", cadence: "Second Tuesday · monthly", stripePriceId: "price_1LgW", status: "active", memberCapacity: 14 },
  { id: "clb8", name: "Debut Table", location: "Prologue", description: "", genre: "Debut Fiction", cadence: "Third Monday · monthly", stripePriceId: "price_1LhX", status: "paused", memberCapacity: 14 },
  { id: "clb9", name: "Bramhall Readers", location: "Simply Books", description: "", genre: "Literary Fiction", cadence: "First Wednesday · monthly", stripePriceId: "price_1LiY", status: "active", memberCapacity: 16 },
  { id: "clb10", name: "Cosy Crime", location: "Simply Books", description: "", genre: "Crime & Thriller", cadence: "Second Monday · monthly", stripePriceId: "price_1LjZ", status: "active", memberCapacity: 15 },
  { id: "clb11", name: "Simply Classics", location: "Simply Books", description: "", genre: "Classics", cadence: "Last Tuesday · monthly", stripePriceId: "price_1Lk1", status: "active", memberCapacity: 15 },
  // Deliberately unset — demonstrates the "no capacity set" fallback.
  { id: "clb12", name: "Young Readers (YA)", location: "Simply Books", description: "", genre: "Young Adult", cadence: "Fortnightly · Saturdays", stripePriceId: "price_1Ll2", status: "active", memberCapacity: null },
  { id: "clb13", name: "Feel-Good Fiction", location: "Simply Books", description: "", genre: "Romance", cadence: "Third Thursday · monthly", stripePriceId: "price_1Lm3", status: "active", memberCapacity: 10 },
  { id: "clb14", name: "History & Ideas", location: "Simply Books", description: "", genre: "Non-fiction", cadence: "First Friday · monthly", stripePriceId: "price_1Ln4", status: "inactive", memberCapacity: 12 },
];

// Book pool for seeded selections — publisher ids match hub-mock's Publishers.
export const BOOK_POOL = [
  { title: "Intermezzo", isbn: "9780571391110", publisherId: "pubFaber", imprint: "Faber", rrp: 20.0 },
  { title: "The Ministry of Time", isbn: "9781399726368", publisherId: "pubPanMac", imprint: "Picador", rrp: 16.99 },
  { title: "James", isbn: "9781035031245", publisherId: "pubPanMac", imprint: "Mantle", rrp: 18.99 },
  { title: "Orbital", isbn: "9781529922936", publisherId: "pubPRH", imprint: "Vintage", rrp: 14.99 },
  { title: "The Bee Sting", isbn: "9780241347355", publisherId: "pubPRH", imprint: "Hamish Hamilton", rrp: 20.0 },
  { title: "Held", isbn: "9781526666246", publisherId: "pubBloomsbury", imprint: "Bloomsbury Circus", rrp: 18.99 },
  { title: "Caledonian Road", isbn: "9781399813204", publisherId: "pubFaber", imprint: "Faber", rrp: 20.0 },
  { title: "The Wren, The Wren", isbn: "9781787334298", publisherId: "pubPRH", imprint: "Jonathan Cape", rrp: 18.99 },
  { title: "Enlightenment", isbn: "9781787334618", publisherId: "pubPRH", imprint: "Jonathan Cape", rrp: 18.99 },
  { title: "Wild Houses", isbn: "9780008626433", publisherId: "pubHarper", imprint: "Fourth Estate", rrp: 16.99 },
];

interface Store {
  members: Member[];
  clubs: Club[];
  memberships: ClubMembership[];
  selections: BookSelection[];
}

function daysAgoIso(d: number): string {
  return new Date(Date.now() - d * 864e5).toISOString();
}

function seed(): Store {
  const rnd = prng(20260718);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

  const members: Member[] = [];
  const used = new Set<string>();
  while (members.length < 34) {
    const f = pick(FIRST);
    const l = pick(LAST);
    if (used.has(f + l)) continue;
    used.add(f + l);
    const i = members.length;
    members.push({
      id: `mem${i + 1}`,
      name: `${f} ${l}`,
      email: `${f}.${l}`.toLowerCase() + "@" + pick(["gmail.com", "outlook.com", "me.com", "proton.me"]),
      phone: `07${300 + Math.floor(rnd() * 600)} ${100000 + Math.floor(rnd() * 900000)}`,
      address:
        rnd() < 0.3
          ? ""
          : `${1 + Math.floor(rnd() * 90)} ${pick(["Weir St", "Bramhall Ln", "Heaton Moor Rd", "Wellington Rd", "Petersgate"])}, Stockport SK${1 + Math.floor(rnd() * 8)} ${1 + Math.floor(rnd() * 9)}${pick(["AB", "DE", "JQ", "RT"])}`,
      stripeCustomerId: `cus_mock${(1000 + i).toString(36)}${i}`,
      notes: pick(NOTES),
    });
  }

  const clubs: Club[] = CLUB_SEED.map((c) => ({ ...c, kind: "book-club" }));

  const memberships: ClubMembership[] = [];
  let subN = 5000;
  for (const club of clubs) {
    if (club.status === "inactive") continue;
    const size = 6 + Math.floor(rnd() * 15); // 6..20
    const pool = [...members].sort(() => rnd() - 0.5).slice(0, size);
    for (const m of pool) {
      const roll = rnd();
      const status = club.status === "paused" ? (roll < 0.5 ? "paused" : "active") : roll < 0.8 ? "active" : roll < 0.9 ? "paused" : "cancelled";
      const payFail = status === "active" && rnd() < 0.1;
      memberships.push({
        id: `sub${subN++}`,
        memberId: m.id,
        clubId: club.id,
        stripeSubscriptionId: `sub_mock${subN}`,
        status,
        joined: `${2023 + Math.floor(rnd() * 3)}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 27)).padStart(2, "0")}`,
        payStatus: payFail ? (rnd() < 0.5 ? "failed" : "past_due") : "ok",
        cardLabel: `•••• ${1000 + Math.floor(rnd() * 9000)}`,
        periodEnd: `2026-08-${String(1 + Math.floor(rnd() * 27)).padStart(2, "0")}`,
        amount: pick([8, 10, 12, 12, 15]),
        log: [],
      });
    }
  }

  // Selections: current month for ~2/3 of active clubs (the rest show "not
  // yet picked"), plus a 3-month history for every club. Ids and hub line
  // ids are DETERMINISTIC so hub-mock can seed the matching draft lines
  // without importing this module.
  const selections: BookSelection[] = [];
  const month = currentMonthKey();
  const history = recentMonthKeys(4).slice(1); // previous 3 months
  const activeClubs = clubs.filter((c) => c.status === "active");
  activeClubs.forEach((club, i) => {
    history.forEach((histMonth, h) => {
      const bk = BOOK_POOL[(i + h + 3) % BOOK_POOL.length];
      selections.push({
        id: `sel_${club.id}_${histMonth}`,
        clubId: club.id,
        month: histMonth,
        title: bk.title,
        isbn: bk.isbn,
        publisherId: bk.publisherId,
        imprint: bk.imprint,
        rrp: bk.rrp,
        selectedBy: "Priya Nair",
        selectedAt: daysAgoIso(30 * (h + 1) + 4),
        hostCopy: true,
        quantity: 10 + ((i + h) % 6),
        hubLineId: null, // history lines long arrived; not seeded in the hub
      });
    });
    if (i % 3 === 2) return; // ~1/3 not yet picked this month
    const bk = BOOK_POOL[i % BOOK_POOL.length];
    const active = memberships.filter((s) => s.clubId === club.id && s.status === "active").length;
    selections.push({
      id: `sel_${club.id}_${month}`,
      clubId: club.id,
      month,
      title: bk.title,
      isbn: bk.isbn,
      publisherId: bk.publisherId,
      imprint: bk.imprint,
      rrp: bk.rrp,
      selectedBy: "Priya Nair",
      selectedAt: daysAgoIso(2),
      hostCopy: true,
      quantity: active + 1,
      hubLineId: `HL-bc-${club.id}`,
    });
  });

  return { members, clubs, memberships, selections };
}

const g = globalThis as typeof globalThis & { __clubsStore?: Store };
const store = (): Store => (g.__clubsStore ??= seed());

/** Raw store accessor for hub-mock's seed (drafts mirror seeded selections)
 *  and tests. Mock-only — nothing outside lib/data may use this. */
export const clubsMockStore = store;

const entry = (by: string, action: string): AuditEntry => ({ at: new Date().toISOString(), by, action });

let idN = 100;

export const mockClubsDataSource: ClubsDataSource = {
  async listMembers() {
    return store().members;
  },
  async getMember(id) {
    return store().members.find((m) => m.id === id) ?? null;
  },
  async createMember(input: MemberInput) {
    const m: Member = { id: `mem${++idN}`, ...input };
    store().members.push(m);
    return m;
  },
  async updateMember(id, input) {
    const m = store().members.find((x) => x.id === id);
    if (!m) throw new Error("Member not found");
    Object.assign(m, input);
    return m;
  },

  async listClubs() {
    return store().clubs;
  },
  async getClub(id) {
    return store().clubs.find((c) => c.id === id) ?? null;
  },

  async listMemberships() {
    return store().memberships;
  },

  async listSelections() {
    return store().selections;
  },
  async saveSelection(input: BookSelectionInput, byName: string) {
    const s = store();
    let sel = s.selections.find((x) => x.clubId === input.clubId && x.month === input.month);
    if (sel) {
      Object.assign(sel, input, { selectedBy: byName, selectedAt: new Date().toISOString() });
    } else {
      sel = {
        ...input,
        id: `sel_${input.clubId}_${input.month}`,
        selectedBy: byName,
        selectedAt: new Date().toISOString(),
        hubLineId: null,
      };
      s.selections.push(sel);
    }
    return sel;
  },
  async setSelectionHubLine(id, hubLineId) {
    const sel = store().selections.find((x) => x.id === id);
    if (sel) sel.hubLineId = hubLineId;
  },
  async updateSelectionOrderStatus() {
    // Mock selections reflect the hub line's state directly — nothing to mirror.
  },

  async getPaymentHistory(memberId) {
    // Synthesised history: monthly renewals per membership; a failed row when
    // the membership is currently failing.
    const subs = store().memberships.filter((s) => s.memberId === memberId);
    const out: PaymentRecord[] = [];
    subs.forEach((sub, i) => {
      const club = store().clubs.find((c) => c.id === sub.clubId);
      for (let mo = 0; mo < 4; mo++) {
        const d = new Date();
        d.setUTCMonth(d.getUTCMonth() - mo, 1);
        const failed = mo === 0 && sub.payStatus !== "ok";
        out.push({
          id: `pay_${sub.id}_${mo}_${i}`,
          date: d.toISOString().slice(0, 10),
          amount: sub.amount,
          status: failed ? "failed" : "succeeded",
          description: `${club?.name ?? "Club"} · monthly`,
        });
      }
    });
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  async cancelMembership(id, when, byName) {
    const sub = store().memberships.find((s) => s.id === id);
    if (!sub) throw new Error("Membership not found");
    sub.status = "cancelled";
    sub.log.push(entry(byName, when === "now" ? "Cancelled immediately" : `Cancelled at period end (${sub.periodEnd})`));
    return sub;
  },
  async pauseMembership(id, byName) {
    const sub = store().memberships.find((s) => s.id === id);
    if (!sub) throw new Error("Membership not found");
    sub.status = "paused";
    sub.log.push(entry(byName, "Paused (Stripe subscription pause)"));
    return sub;
  },
  async resumeMembership(id, byName) {
    const sub = store().memberships.find((s) => s.id === id);
    if (!sub) throw new Error("Membership not found");
    sub.status = "active";
    sub.log.push(entry(byName, "Resumed"));
    return sub;
  },
  async moveMembership(id, targetClubId, byName) {
    const s = store();
    const sub = s.memberships.find((x) => x.id === id);
    const target = s.clubs.find((c) => c.id === targetClubId);
    if (!sub || !target) throw new Error("Membership or target club not found");
    const from = s.clubs.find((c) => c.id === sub.clubId);
    sub.clubId = targetClubId;
    sub.status = "active";
    sub.stripeSubscriptionId = `sub_mock${Date.now() % 1e7}`;
    sub.log.push(entry(byName, `Moved from ${from?.name ?? "?"} to ${target.name} (old sub cancelled, new sub created)`));
    return sub;
  },

  async applyStripeEvent(evt) {
    const sub = store().memberships.find((s) => s.stripeSubscriptionId === evt.subscriptionId);
    if (!sub) return;
    if (evt.payStatus) sub.payStatus = evt.payStatus;
    if (evt.status) sub.status = evt.status;
    if (evt.periodEnd) sub.periodEnd = evt.periodEnd;
    sub.log.push(entry("Stripe webhook", evt.type));
  },
};
