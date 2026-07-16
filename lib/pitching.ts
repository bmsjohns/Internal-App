// ---------------------------------------------------------------------------
// Events module, Phase 1: Pitching — status/priority model.
//
// Same approach as the Orders status model in lib/config.ts: the live Event
// Pitching table has 13 overlapping Status options (pulled from the base on
// 16 Jul 2026). The board works with canonical pipeline stages; every raw
// Airtable string maps into one for display/columns, and moves write
// `writeAs` — an EXISTING Airtable option — so no schema change is needed.
// The raw string stays visible on the pitch detail page. Consolidating the
// base's options is a separate proposal for Ben (see README §Events).
//
// Mapping judgement calls, flagged for Ben:
//  - "Opportunity from London" (81 of 123 records) is a SOURCE, not a stage —
//    shown under Wishlist for now.
//  - "Doing Events" reads as "author already doing events with us" — shown
//    under Won.
//  - "Identified" vs "Wishlist" overlap — both under Wishlist.
// ---------------------------------------------------------------------------

export interface PitchStage {
  key: string;
  label: string;
  color: string;
  writeAs: string; // exact Airtable select option written on save
  raw: string[]; // Airtable options that display as this stage
}

export const PITCH_STAGES: PitchStage[] = [
  {
    key: "wishlist",
    label: "Wishlist",
    color: "#2B4C6F",
    writeAs: "Wishlist",
    raw: ["Wishlist", "Identified", "Opportunity from London"],
  },
  {
    key: "to-review",
    label: "To review",
    color: "#B0812F",
    writeAs: "To Review/Allocate",
    raw: ["To Review/Allocate"],
  },
  {
    key: "pitch-prep",
    label: "Preparing pitch",
    color: "#8C857C",
    writeAs: "To Pitch",
    raw: ["To Pitch", "To Pitch - Elinor Creating", "Pitch To Review"],
  },
  {
    key: "pitch-sent",
    label: "Pitch sent",
    color: "#AD3B28",
    writeAs: "Pitch Sent",
    raw: ["Pitch Sent"],
  },
  {
    key: "in-discussions",
    label: "In discussions",
    color: "#3A322C",
    writeAs: "In Discussions",
    raw: ["In Discussions"],
  },
  {
    key: "won",
    label: "Won",
    color: "#5F7355",
    writeAs: "Closed - Won",
    raw: ["Closed - Won", "Doing Events"],
  },
  {
    key: "lost",
    label: "Lost",
    color: "#DA4F4A",
    writeAs: "Closed - Lost",
    raw: ["Closed - Lost"],
  },
  {
    key: "archive",
    label: "Archive",
    color: "#B8B0A6",
    writeAs: "Archive",
    raw: ["Archive"],
  },
];

const stageIndex = new Map<string, PitchStage>();
for (const s of PITCH_STAGES) for (const r of s.raw) stageIndex.set(r.toLowerCase(), s);

/** Map a raw Airtable status string to its canonical stage (default: wishlist). */
export function pitchStage(raw: string): PitchStage {
  return stageIndex.get(raw.trim().toLowerCase()) ?? PITCH_STAGES[0];
}

// Priority options in the live base are clean — used verbatim.
export const PITCH_PRIORITIES = ["Low", "Medium", "High", "Mission Critical"] as const;

export const PRIORITY_COLORS: Record<string, string> = {
  Low: "#5F7355",
  Medium: "#B0812F",
  High: "#DA4F4A",
  "Mission Critical": "#1A1714",
};

// Lead is an Airtable collaborator field, and base collaborators aren't
// enumerable over the REST API — so, like TEAM_MEMBER_OPTIONS in the Orders
// module, the picker is a hardcoded list of the collaborators seen in the
// live table. Writes send { email }, which Airtable resolves to the
// collaborator. Add people here when the team grows.
export const PITCH_LEADS = [
  { name: "Ben Johns", email: "ben@simplybooks.co.uk" },
  { name: "Elinor Wise", email: "elinor@simplybooks.co.uk" },
  { name: "Charlotte Moore", email: "charlotte@simplybooks.co.uk" },
];

/** Sortable list-view columns (§3.1a). */
export type PitchSortKey =
  | "authorName"
  | "bookTitle"
  | "status"
  | "priority"
  | "publicationDate"
  | "rating";
