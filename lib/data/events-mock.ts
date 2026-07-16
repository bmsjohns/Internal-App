import type { EventVenue, Imprint, Pitch, PitchInput } from "@/lib/types";
import type { EventsDataSource } from "./events-source";

// In-memory mock for the Events base — keeps development off the live base
// (DATA_SOURCE=mock), same as lib/data/mock.ts does for Orders. Seed data
// mirrors the shape of the real Event Pitching table: a spread of raw
// statuses (including the messy ones the canonical stages absorb), real
// imprint→publisher pairs, and venues in the three Location areas.

const VENUES: EventVenue[] = [
  { id: "ven-simply", name: "Simply Books", locations: ["Bramhall"] },
  { id: "ven-prologue", name: "Prologue", locations: ["Stockport"] },
  { id: "ven-plaza", name: "The Plaza", locations: ["Stockport"] },
  { id: "ven-village-club", name: "Bramhall Village Club", locations: ["Bramhall"] },
  { id: "ven-st-peters", name: "St Peter's Church", locations: ["Stockport"] },
];

const IMPRINTS: Imprint[] = [
  { id: "imp-penguin-general", name: "Penguin General", publisherName: "Penguin Random House" },
  { id: "imp-michael-joseph", name: "Penguin Michael Joseph", publisherName: "Penguin Random House" },
  { id: "imp-century", name: "Century", publisherName: "Penguin Random House" },
  { id: "imp-vintage", name: "Vintage", publisherName: "Penguin Random House" },
  { id: "imp-transworld", name: "Transworld", publisherName: "Penguin Random House" },
  { id: "imp-hodder", name: "Hodder & Stoughton", publisherName: "Hachette" },
  { id: "imp-sceptre", name: "Sceptre", publisherName: "Hachette" },
  { id: "imp-simon-schuster", name: "Simon & Schuster", publisherName: "Simon & Schuster" },
  { id: "imp-ebury", name: "Ebury Press", publisherName: "Penguin Random House" },
  { id: "imp-quadrille", name: "Quadrille", publisherName: "Hardie Grant" },
];

const imprintName = (id: string) => IMPRINTS.find((i) => i.id === id)?.name ?? "";
const imprintPublisher = (id: string) => IMPRINTS.find((i) => i.id === id)?.publisherName ?? "";
const venueName = (id: string) => VENUES.find((v) => v.id === id)?.name ?? "";

let seq = 100;

function seed(
  p: Partial<Pitch> & Pick<Pitch, "authorName" | "status">
): Pitch {
  const imprintIds = p.imprintIds ?? [];
  const proposedVenueIds = p.proposedVenueIds ?? [];
  return {
    id: `pitch-${seq++}`,
    bookTitle: "",
    isbn: "",
    publisherIds: [],
    publisherNames: imprintIds.map(imprintPublisher).filter(Boolean),
    imprintNames: imprintIds.map(imprintName),
    publicationDate: null,
    priority: "",
    initialHighPriority: false,
    leadName: "",
    leadEmail: "",
    publicist: "",
    publicistEmail: "",
    pitchDeck: [],
    proposedVenueNames: proposedVenueIds.map(venueName),
    proposedDates: "",
    estimatedAudienceSize: "",
    pitchingNotes: "",
    opportunityNotes: "",
    rating: null,
    location: null,
    createdAt: "2026-06-01T10:00:00.000Z",
    ...p,
    imprintIds,
    proposedVenueIds,
  };
}

const pitches: Pitch[] = [
  seed({
    authorName: "Richard Osman",
    bookTitle: "The Impossible Fortune",
    status: "Opportunity from London",
    priority: "High",
    initialHighPriority: true,
    rating: 5,
    imprintIds: ["imp-penguin-general"],
    leadName: "Ben Johns",
    leadEmail: "ben@simplybooks.co.uk",
    publicationDate: "2026-09-18",
    proposedVenueIds: ["ven-plaza"],
    proposedDates: "Late Sept / early Oct, avoid school hols",
    estimatedAudienceSize: "800+",
    pitchingNotes: "Huge draw — would need the Plaza. Publicist keen on northern dates.",
  }),
  seed({
    authorName: "Dr Rangan Chatterjee",
    bookTitle: "Make Change That Lasts",
    status: "Pitch To Review",
    priority: "High",
    rating: 4,
    imprintIds: ["imp-michael-joseph"],
    leadName: "Elinor Wise",
    leadEmail: "elinor@simplybooks.co.uk",
    publicist: "Sarah Kennedy",
    publicistEmail: "sarah.kennedy@penguinrandomhouse.co.uk",
    proposedVenueIds: ["ven-plaza", "ven-prologue"],
    proposedDates: "January — new year wellness angle",
    estimatedAudienceSize: "400-600",
    pitchingNotes: "Local author (Wilmslow). Deck drafted, needs numbers checked.",
  }),
  seed({
    authorName: "Jenny Colgan",
    bookTitle: "The Christmas Bookshop Returns",
    status: "To Pitch",
    priority: "High",
    imprintIds: ["imp-sceptre"],
    leadName: "Charlotte Moore",
    leadEmail: "charlotte@simplybooks.co.uk",
    publicationDate: "2026-10-22",
    proposedVenueIds: ["ven-simply"],
    proposedDates: "November, pre-Christmas",
    estimatedAudienceSize: "120",
  }),
  seed({
    authorName: "Emma Cowing",
    bookTitle: "The Show Woman",
    status: "To Review/Allocate",
    priority: "Medium",
    imprintIds: ["imp-hodder"],
    leadName: "Elinor Wise",
    leadEmail: "elinor@simplybooks.co.uk",
    opportunityNotes: "Publicist offered a two-shop mini tour with **Saliha Mahmood Ahmed** the same week.",
  }),
  seed({
    authorName: "Holly McNish",
    bookTitle: "Lobster",
    status: "Pitch Sent",
    priority: "High",
    rating: 4,
    imprintIds: ["imp-vintage"],
    leadName: "Ben Johns",
    leadEmail: "ben@simplybooks.co.uk",
    publicist: "Amy Winchester",
    publicistEmail: "amy.winchester@vintagebooks.co.uk",
    proposedVenueIds: ["ven-prologue"],
    proposedDates: "w/c 12 Oct proposed in deck",
    estimatedAudienceSize: "150",
    pitchDeck: [
      { id: "att-1", filename: "holly-mcnish-prologue-pitch.pdf", url: "about:blank", size: 482000 },
    ],
  }),
  seed({
    authorName: "Anthony Horowitz",
    bookTitle: "Marble Hall Murders",
    status: "In Discussions",
    priority: "Mission Critical",
    rating: 5,
    imprintIds: ["imp-century"],
    leadName: "Ben Johns",
    leadEmail: "ben@simplybooks.co.uk",
    proposedVenueIds: ["ven-plaza"],
    proposedDates: "Spring 2027 tour slot",
    estimatedAudienceSize: "500",
    pitchingNotes: "Publicist comparing us against Waterstones Deansgate — emphasise indie angle + Plaza capacity.",
  }),
  seed({
    authorName: "Holly Jackson",
    status: "Closed - Won",
    priority: "High",
    rating: 5,
    imprintIds: ["imp-michael-joseph"],
    leadName: "Charlotte Moore",
    leadEmail: "charlotte@simplybooks.co.uk",
    pitchingNotes: "Confirmed! Move to Events board once Phase 2 lands.",
  }),
  seed({
    authorName: "Louise Penny",
    bookTitle: "The Black Wolf",
    status: "Closed - Lost",
    priority: "High",
    imprintIds: ["imp-hodder"],
    pitchingNotes: "UK dates cancelled — publicist will revisit for paperback.",
  }),
  seed({
    authorName: "Bob Mortimer",
    bookTitle: "The Hotel Avocado (paperback)",
    status: "Doing Events",
    rating: 5,
    imprintIds: ["imp-simon-schuster"],
  }),
  seed({
    authorName: "MARY BERRY",
    status: "Wishlist",
    priority: "Medium",
    imprintIds: ["imp-ebury"],
    opportunityNotes: "Perennial wishlist — check autumn 2027 title schedule.",
  }),
  seed({
    authorName: "Susie Dent",
    status: "Identified",
    priority: "Medium",
    rating: 3,
    leadName: "Elinor Wise",
    leadEmail: "elinor@simplybooks.co.uk",
  }),
  seed({
    authorName: "Jenny Eclair",
    status: "Archive",
    priority: "Low",
    imprintIds: ["imp-quadrille"],
  }),
];

export const mockEventsDataSource: EventsDataSource = {
  async listPitches() {
    return [...pitches];
  },
  async getPitch(id) {
    return pitches.find((p) => p.id === id) ?? null;
  },
  async createPitch(input) {
    const pitch = seed({
      ...input,
      authorName: input.authorName,
      status: input.status,
      leadName: input.leadEmail.split("@")[0] || "",
      createdAt: new Date().toISOString(),
    });
    pitch.id = `pitch-${seq++}`;
    pitches.unshift(pitch);
    return pitch;
  },
  async updatePitch(id, input) {
    const i = pitches.findIndex((p) => p.id === id);
    if (i === -1) throw new Error("Pitch not found");
    const merged = { ...pitches[i], ...input } as Pitch;
    if (input.imprintIds) {
      merged.imprintNames = input.imprintIds.map(imprintName);
      merged.publisherNames = input.imprintIds.map(imprintPublisher).filter(Boolean);
    }
    if (input.proposedVenueIds) merged.proposedVenueNames = input.proposedVenueIds.map(venueName);
    if (input.leadEmail !== undefined) {
      const known: Record<string, string> = {
        "ben@simplybooks.co.uk": "Ben Johns",
        "elinor@simplybooks.co.uk": "Elinor Wise",
        "charlotte@simplybooks.co.uk": "Charlotte Moore",
      };
      merged.leadName = known[input.leadEmail] ?? input.leadEmail;
    }
    pitches[i] = merged;
    return merged;
  },
  async deletePitch(id) {
    const i = pitches.findIndex((p) => p.id === id);
    if (i !== -1) pitches.splice(i, 1);
  },

  async uploadPitchDeck(id, file) {
    const pitch = pitches.find((p) => p.id === id);
    if (!pitch) throw new Error("Pitch not found");
    pitch.pitchDeck = [
      ...pitch.pitchDeck,
      {
        id: `att-${seq++}`,
        filename: file.filename,
        url: `data:${file.contentType};base64,${file.base64}`,
        size: Math.round((file.base64.length * 3) / 4),
      },
    ];
    return pitch;
  },

  async listVenues() {
    return [...VENUES];
  },
  async listImprints() {
    return [...IMPRINTS];
  },
};
