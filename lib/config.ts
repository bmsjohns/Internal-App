import type { Location } from "@/lib/types";

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------
export type VenueKey = "simply" | "prologue";

export const VENUES: Record<VenueKey, { label: Location; short: string; color: string }> = {
  simply: { label: "Simply Books", short: "Bramhall", color: "#2B4C6F" },
  prologue: { label: "Prologue", short: "Weir Mill", color: "#AD3B28" },
};

export const venueKeyOf = (location: Location): VenueKey =>
  location === "Prologue" ? "prologue" : "simply";

export const DEFAULT_LOCATION: Location = "Simply Books";

// ---------------------------------------------------------------------------
// Status model
//
// The live Airtable base has 18 overlapping status options. The V2 UI works
// with the 7 canonical statuses from the design; every raw Airtable string
// maps into one for display/filtering, and the form writes `writeAs` — an
// EXISTING Airtable option — so no schema change or typecast is needed.
// The raw string is still shown on the order detail page, so nothing is
// hidden. Consolidating the base itself remains a separate migration for
// Ben to approve (see README).
// ---------------------------------------------------------------------------
export interface CanonicalStatus {
  key: string;
  label: string;
  color: string;
  writeAs: string; // exact Airtable select option written on save
  raw: string[]; // Airtable options that display as this status
}

export const CANONICAL_STATUSES: CanonicalStatus[] = [
  {
    key: "needs-ordering",
    label: "Needs ordering",
    color: "#B0812F",
    writeAs: "Not Ordered",
    raw: ["Not Ordered", "Special Order", "Not paid"],
  },
  {
    key: "ordered",
    label: "Ordered",
    color: "#8C857C",
    writeAs: "Ordered",
    raw: ["Ordered", "Ordered - In Basket", "Ordered - extended catalogue", "preordered", "Issue Resolved"],
  },
  {
    key: "in-store",
    label: "In store",
    color: "#3A322C",
    writeAs: "Already In Stock",
    raw: ["Already In Stock"],
  },
  {
    key: "ready",
    label: "Ready for collection",
    color: "#AD3B28",
    writeAs: "Ready to Ship",
    raw: ["Ready to Ship", "Delivery"],
  },
  {
    key: "collected",
    label: "Collected",
    color: "#5F7355",
    writeAs: "Collected",
    raw: ["Collected", "Shipped"],
  },
  {
    key: "cant-get",
    label: "Can't get",
    color: "#DA4F4A",
    writeAs: "Can't get",
    raw: ["Can't get", "Issue"],
  },
  {
    key: "cancelled",
    label: "Cancelled",
    color: "#B8B0A6",
    writeAs: "Cancelled",
    raw: ["Cancelled", "Cancelled order", "Expired"],
  },
];

const rawIndex = new Map<string, CanonicalStatus>();
for (const s of CANONICAL_STATUSES) for (const r of s.raw) rawIndex.set(r.toLowerCase(), s);

/** Map a raw Airtable status string to its canonical status (default: needs-ordering). */
export function canonicalStatus(raw: string): CanonicalStatus {
  return rawIndex.get(raw.trim().toLowerCase()) ?? CANONICAL_STATUSES[0];
}

/** The five stages shown on the order-detail progress timeline. */
export const TIMELINE_KEYS = ["needs-ordering", "ordered", "in-store", "ready", "collected"];

export const PAID_OPTIONS = ["Paid", "Not Paid", "Paid Online", "Ordered"];
export const PAID_COLORS: Record<string, string> = {
  Paid: "#5F7355",
  "Paid Online": "#5F7355",
  "Not Paid": "#B0812F",
  Ordered: "#8C857C",
};

export const DELIVERY_METHODS = ["Collection", "Delivery", "Drop-Off"];

// Current Team Member select options in the live base (duplicates and casing
// preserved — see README §Team Member). Used only to match the logged-in
// user's first name to an existing option; never shown as a 31-item picker.
export const TEAM_MEMBER_OPTIONS = [
  "Ben", "Karen", "Ellie", "Matt", "Anna", "Elinor", "Darren", "Alice",
  "Chloe", "Liv", "Holly", "Lynsey", "Freya", "Priya", "Noah", "Lucy",
  "Charlotte", "Berivan", "Barbara", "Rachel", "Ines", "Sandra", "Anya",
  "Lara", "Jess", "Sophie", "Liv S", "gemma", "lar",
];

/** Match a logged-in user's name to an existing Team Member option, if any. */
export function matchTeamMember(userName: string): string | null {
  const first = userName.trim().split(/\s+/)[0]?.toLowerCase();
  if (!first) return null;
  return (
    TEAM_MEMBER_OPTIONS.find((o) => o.toLowerCase() === userName.trim().toLowerCase()) ??
    TEAM_MEMBER_OPTIONS.find((o) => o.toLowerCase() === first) ??
    null
  );
}

/** Relative "2h ago" formatting for the queue's Added column. */
export function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
