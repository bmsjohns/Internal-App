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
  /** One-line column subtitle on the board (Claude Design "Order Book.dc.html"). */
  hint: string;
  writeAs: string; // exact Airtable select option written on save
  raw: string[]; // Airtable options that display as this stage
}

// Colours follow the design file's pitching palette (stone → ochre → moss →
// rust for the pipeline, fog for terminal states), extended to cover the 8
// canonical stages the real data needs (the design mocked 5).
export const PITCH_STAGES: PitchStage[] = [
  {
    key: "wishlist",
    label: "Wishlist",
    color: "#8C857C",
    hint: "Idea captured",
    writeAs: "Wishlist",
    raw: ["Wishlist", "Identified", "Opportunity from London"],
  },
  {
    key: "to-review",
    label: "To review",
    color: "#2B4C6F",
    hint: "Needs a decision & a lead",
    writeAs: "To Review/Allocate",
    raw: ["To Review/Allocate"],
  },
  {
    key: "pitch-prep",
    label: "Preparing pitch",
    color: "#B0812F",
    hint: "Deck in progress",
    writeAs: "To Pitch",
    raw: ["To Pitch", "To Pitch - Elinor Creating", "Pitch To Review"],
  },
  {
    key: "pitch-sent",
    label: "Pitch sent",
    color: "#DA4F4A",
    hint: "Waiting to hear",
    writeAs: "Pitch Sent",
    raw: ["Pitch Sent"],
  },
  {
    key: "in-discussions",
    label: "In discussions",
    color: "#5F7355",
    hint: "Talking terms",
    writeAs: "In Discussions",
    raw: ["In Discussions"],
  },
  {
    key: "won",
    label: "Won",
    color: "#AD3B28",
    hint: "Becomes a booking → Phase 2",
    writeAs: "Closed - Won",
    raw: ["Closed - Won", "Doing Events"],
  },
  {
    key: "lost",
    label: "Lost",
    color: "#B8B0A6",
    hint: "Not proceeding",
    writeAs: "Closed - Lost",
    raw: ["Closed - Lost"],
  },
  {
    key: "archive",
    label: "Archive",
    color: "#A9A196",
    hint: "Parked for now",
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

// Priority colours per the design file (low stone / medium ochre / high rust);
// Mission Critical exists only in the live base — deep rust, a notch past High.
export const PRIORITY_COLORS: Record<string, string> = {
  Low: "#8C857C",
  Medium: "#B0812F",
  High: "#AD3B28",
  "Mission Critical": "#8B2D1E",
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
