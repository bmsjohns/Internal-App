// Exact select-option strings from the live Airtable base ("Customer Orders",
// appAlp6BBobAiV0d6). Airtable rejects writes with unknown select values, so
// these must stay in sync with the base schema.

// The live Status field has 18 overlapping options. We keep the exact strings
// (safe to write back) but present them grouped in the UI. A consolidation
// proposal for Ben is in README.md — do not remove options here until the
// live base is migrated.
export const STATUS_GROUPS: { label: string; statuses: string[] }[] = [
  {
    label: "To do",
    statuses: ["Not Ordered", "Special Order", "preordered"],
  },
  {
    label: "In progress",
    statuses: ["Ordered", "Ordered - In Basket", "Ordered - extended catalogue", "Delivery"],
  },
  {
    label: "Ready / done",
    statuses: ["Ready to Ship", "Shipped", "Collected", "Already In Stock"],
  },
  {
    label: "Problems",
    statuses: ["Can't get", "Issue", "Issue Resolved", "Expired"],
  },
  {
    label: "Closed",
    statuses: ["Cancelled", "Cancelled order"],
  },
  {
    label: "Legacy (avoid — see README)",
    statuses: ["Not paid"],
  },
];

export const ALL_STATUSES = STATUS_GROUPS.flatMap((g) => g.statuses);

// Statuses that mean "this book still needs to be ordered from the supplier".
// Drives the End-of-day summary. Adjust here if the team's meaning differs.
export const NEEDS_ORDERING_STATUSES = ["Not Ordered", "Special Order"];

export const PAID_OPTIONS = ["Paid", "Not Paid", "Paid Online", "Ordered"];

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

export const DEFAULT_LOCATION = "Simply Books";
