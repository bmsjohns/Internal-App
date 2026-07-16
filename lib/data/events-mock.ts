import type {
  EventVenue,
  Host,
  Imprint,
  Pitch,
  PitchInput,
  ShowEvent,
  ShowEventInput,
  Venue,
} from "@/lib/types";
import type { EventsDataSource } from "./events-source";

// In-memory mock for the Events base — keeps development off the live base
// (DATA_SOURCE=mock), same as lib/data/mock.ts does for Orders. Seed data
// mirrors the shape of the real Event Pitching table: a spread of raw
// statuses (including the messy ones the canonical stages absorb), real
// imprint→publisher pairs, and venues in the three Location areas.

// Phase 2: full venue records (Phase 1's picker list derives from these, so
// pitch venue links and event venue links point at the same ids).
const VENUES_FULL: Venue[] = [
  {
    id: "ven-prologue", name: "Prologue — Weir Mill event space", capacity: "150",
    locations: ["Stockport"], status: "Done", tags: ["Ticketed", "Bar"],
    notes: "Main event room upstairs. PA + lectern mic. Load-in via the yard off Chestergate.",
    techSpec: [{ id: "att-v1", filename: "PA_and_rig_weirmill.pdf", url: "about:blank", size: 210000 }],
    photo: [], eventIds: [],
  },
  {
    id: "ven-prologue-cafe", name: "Prologue — café floor", capacity: "45",
    locations: ["Stockport"], status: "Done", tags: ["Launch", "Informal", "Bar"],
    notes: "Clear the café after 5pm. Small PA only — fine for readings, not amplified music.",
    techSpec: [], photo: [], eventIds: [],
  },
  {
    id: "ven-simply", name: "Simply Books — Bramhall", capacity: "60",
    locations: ["Bramhall"], status: "Done", tags: ["Family", "Schools"],
    notes: "Shop-floor events — rearrange the front tables. Best for daytime family & school sessions.",
    techSpec: [], photo: [], eventIds: [],
  },
  {
    id: "ven-plaza", name: "The Plaza", capacity: "1200",
    locations: ["Stockport"], status: "In progress", tags: ["External", "Ticketed"],
    notes: "Hired for the biggest names. Book 6+ weeks ahead. Their AV, our stock table.",
    techSpec: [{ id: "att-v4", filename: "plaza_av_spec.pdf", url: "about:blank", size: 480000 }],
    photo: [], eventIds: [],
  },
  {
    id: "ven-village-club", name: "Bramhall Village Club", capacity: "120",
    locations: ["Bramhall"], status: "Todo", tags: ["External"],
    notes: "Good mid-size room near Simply Books. Bar staffed by the club.",
    techSpec: [], photo: [], eventIds: [],
  },
  { id: "ven-st-peters", name: "St Peter's Church", capacity: "200",
    locations: ["Stockport"], status: "Todo", tags: ["External"],
    notes: "Atmospheric, echoey — spoken word works, panels struggle.", techSpec: [], photo: [], eventIds: [] },
];

const VENUES: EventVenue[] = VENUES_FULL.map((v) => ({ id: v.id, name: v.name, locations: v.locations }));

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

// ---------------------------------------------------------------------------
// Phase 2 seed: Hosts + Events. Staff ids match lib/staff.ts MOCK_STAFF.
// ---------------------------------------------------------------------------

const HOSTS: Host[] = [
  {
    id: "host-ashworth", name: "Jenn Ashworth", phone: "07700 900118", email: "jenn.ashworth@example.com",
    fee: 250, instagram: "https://instagram.com/jennashworth",
    notes: "Novelist & academic. Superb in-conversation chair, especially literary fiction. Prefers a brief the week before.",
    teamContacts: [{ id: "ben", name: "Ben" }], eventIds: [],
  },
  {
    id: "host-hurley", name: "Andrew Michael Hurley", phone: "07700 900245", email: "a.m.hurley@example.com",
    fee: 200, instagram: "", notes: "Great for gothic / genre nights. Local, low travel.",
    teamContacts: [{ id: "lynsey", name: "Lynsey" }], eventIds: [],
  },
  {
    id: "host-mostyn", name: "Nicola Mostyn", phone: "07700 900377", email: "nicola.mostyn@example.com",
    fee: 150, instagram: "https://instagram.com/nicolamostyn",
    notes: "Brilliant with YA and family audiences. Happy to run kids Q&A.",
    teamContacts: [{ id: "charlotte", name: "Charlotte" }], eventIds: [],
  },
  {
    id: "host-inhouse", name: "In-house (Ben)", phone: "07533 771002", email: "ben@simplybooks.co.uk",
    fee: 0, instagram: "", notes: "Ben chairs smaller / local events himself — no fee.",
    teamContacts: [{ id: "ben", name: "Ben" }], eventIds: [],
  },
];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

let roleSeq = 1;
const role = (phase: "pre" | "during" | "post", name: string, staff: { id: string; name: string }[]) => ({
  id: `role-${roleSeq++}`, phase, name, staff,
});
const step = (time: string, phase: "pre" | "during" | "post", title: string, leadId: string | null, note = "") => ({
  id: `step-${roleSeq++}`, time, phase, title, note, leadId,
});
const S = (id: string) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) });

const EVENTS: ShowEvent[] = [
  {
    id: "ev-keyes", name: "Marian Keyes", leadTitle: "Grown Ups (paperback)", isbn: "9780241441244",
    date: daysFromNow(0), time: "19:30", venueId: "ven-prologue", venueName: "Prologue — Weir Mill event space",
    hostId: "host-ashworth", hostName: "Jenn Ashworth",
    types: ["In-house", "Signing"], ages: [],
    format: "45-min in-conversation with Jenn Ashworth, then audience Q&A and a signing. Doors 7pm, bar open throughout. Stock table by the exit.",
    status: "Confirmed", fromPitchId: null,
    roles: [
      role("pre", "Set-up & seating", [S("matt"), S("chloe")]),
      role("pre", "Talent management", [S("ben")]),
      role("pre", "Box office / check-in", [S("charlotte")]),
      role("during", "Front of house", [S("charlotte")]),
      role("during", "Staff bar", [S("chloe"), S("liv")]),
      role("during", "Tech & sound", [S("matt")]),
      role("during", "Chair liaison", [S("ben")]),
      role("post", "Signing table", [S("ben"), S("lynsey")]),
      role("post", "Pack-down", [S("matt"), S("chloe")]),
    ],
    schedule: [
      step("17:30", "pre", "Set-up & seating", "matt", "150 chairs, centre aisle. Stock table + card reader by the exit."),
      step("18:00", "pre", "Sound & AV check", "matt", "Lectern mic + two handhelds for Q&A."),
      step("18:45", "pre", "Talent arrival & green room", "ben", "Mezzanine office. Water, running order printed."),
      step("19:00", "pre", "Doors open · box office", "charlotte", "Check-in on Luma. Bar open."),
      step("19:30", "during", "Welcome & housekeeping", "ben", "2 min — fire exits, phones, signing after."),
      step("19:35", "during", "In conversation", "host", "45 min with Jenn Ashworth."),
      step("20:15", "during", "Audience Q&A", "charlotte", "Roving mic. 6–8 questions, hard stop 8.40."),
      step("20:45", "during", "Closing thanks", "ben", "Plug the signing + next event."),
      step("21:00", "post", "Signing", "ben", "Ben + Lynsey manage the queue. Post-its for names."),
      step("21:15", "post", "Bar & mingle", "chloe"),
      step("21:45", "post", "Pack-down & stock count", "matt", "Reconcile signed stock, chairs away."),
    ],
    legacyStaffing: ["Ben", "Lynsey", "Charlotte", "Matt", "Chloe", "Liv"],
    bookTicket: 150, ticketOnly: 0, minOrder: 80, lumaLink: "https://lu.ma/keyes-prologue", banners: true,
    callSheet: [], callSheetSent: true, salesReportSent: false, mediaCount: 2,
    notes: "Sold out. Signed stock ordered separately (150 copies). Green room = the mezzanine office.",
    createdAt: "2026-06-20T10:00:00.000Z",
  },
  {
    id: "ev-rundell", name: "Katherine Rundell", leadTitle: "Impossible Creatures 2", isbn: "9781408897416",
    date: daysFromNow(19), time: "10:30", venueId: "ven-simply", venueName: "Simply Books — Bramhall",
    hostId: "host-mostyn", hostName: "Nicola Mostyn",
    types: ["School", "In-house"], ages: ["KS2", "9-12"],
    format: "Morning family session — reading, drawing activity, then signing. Two school groups in for the first half.",
    status: "Confirmed", fromPitchId: null,
    roles: [
      role("pre", "Set-up & seating", [S("jess")]),
      role("pre", "School liaison", [S("charlotte")]),
      role("during", "Front of house", [S("charlotte"), S("jess")]),
      role("during", "Author care", [S("lynsey")]),
      role("post", "Signing table", [S("lynsey")]),
      role("post", "Pack-down", [S("jess")]),
    ],
    schedule: [
      step("09:30", "pre", "Set-up & activity tables", "jess", "Low seating at front for kids. Drawing paper + pens out."),
      step("10:00", "pre", "School groups arrive", "charlotte", "Two primaries, ~40 kids. Registers with teachers."),
      step("10:30", "during", "Welcome", "lynsey"),
      step("10:40", "during", "Reading & Q&A", "host", "30 min, kid-friendly."),
      step("11:10", "during", "Drawing activity", "jess", "Illustration prompt from the book."),
      step("11:40", "post", "Signing", "lynsey", "Signed copies for three primaries set aside first."),
      step("12:00", "post", "Pack-down", "jess"),
    ],
    legacyStaffing: ["Lynsey", "Charlotte", "Jess"],
    bookTicket: 60, ticketOnly: 0, minOrder: 40, lumaLink: "https://lu.ma/rundell-simply", banners: false,
    callSheet: [], callSheetSent: false, salesReportSent: false, mediaCount: 0,
    notes: "Half-term. Signed copies promised to three local primaries — coordinate with schools list (Phase 5).",
    createdAt: "2026-06-28T10:00:00.000Z",
  },
  {
    id: "ev-anderson", name: "Nathan Anderson", leadTitle: "Debut poetry launch", isbn: "9781784744021",
    date: daysFromNow(-27), time: "18:00", venueId: "ven-prologue-cafe", venueName: "Prologue — café floor",
    hostId: "host-inhouse", hostName: "In-house (Ben)",
    types: ["Launch", "In-house"], ages: [],
    format: "Low-key café-floor launch. Short reading, drinks, informal signing.",
    status: "Confirmed", fromPitchId: null,
    roles: [
      role("pre", "Set-up", [S("chloe")]),
      role("during", "FOH & bar", [S("chloe"), S("liv")]),
      role("during", "Host", [S("ben")]),
      role("post", "Pack-down", [S("chloe")]),
    ],
    schedule: [],
    legacyStaffing: ["Ben", "Chloe", "Liv"],
    bookTicket: 0, ticketOnly: 40, minOrder: 0, lumaLink: "", banners: false,
    callSheet: [], callSheetSent: false, salesReportSent: true, mediaCount: 0,
    notes: "Local author. Cheap to run, good community goodwill.",
    createdAt: "2026-05-30T10:00:00.000Z",
  },
  {
    id: "ev-stuart", name: "Douglas Stuart", leadTitle: "In conversation + Q&A", isbn: "9781529019278",
    date: daysFromNow(33), time: "19:00", venueId: "ven-prologue", venueName: "Prologue — Weir Mill event space",
    hostId: "host-ashworth", hostName: "Jenn Ashworth",
    types: ["In-house", "Signing"], ages: [],
    format: "Provisional — date being held while the agent confirms. In-conversation + signing, ticketed.",
    status: "Provisional", fromPitchId: null,
    roles: [
      role("pre", "Set-up & seating", []),
      role("pre", "Talent management", [S("ben")]),
      role("during", "Front of house", []),
      role("during", "Staff bar", []),
      role("post", "Signing table", []),
    ],
    schedule: [
      step("17:30", "pre", "Set-up & seating", null, "Owner TBC — assign closer to the date."),
      step("18:30", "pre", "Talent arrival", "ben"),
      step("19:00", "during", "Welcome", "ben"),
      step("19:05", "during", "In conversation", "host", "With Jenn Ashworth."),
      step("19:45", "during", "Audience Q&A", null),
      step("20:30", "post", "Signing & pack-down", null),
    ],
    legacyStaffing: ["Ben"],
    bookTicket: 150, ticketOnly: 0, minOrder: 80, lumaLink: "", banners: false,
    callSheet: [], callSheetSent: false, salesReportSent: false, mediaCount: 0,
    notes: "Holding the date. Fee agreed in principle — waiting on the agent to sign off.",
    createdAt: "2026-07-01T10:00:00.000Z",
  },
  {
    id: "ev-bookclub", name: "First Chapter Club", leadTitle: "Monthly book club night", isbn: "",
    date: daysFromNow(8), time: "19:00", venueId: "ven-prologue-cafe", venueName: "Prologue — café floor",
    hostId: "host-inhouse", hostName: "In-house (Ben)",
    types: ["Book Club Exclusive"], ages: [],
    format: "Monthly members’ book club on the café floor. Bar open, no signing.",
    status: "Confirmed", fromPitchId: null,
    roles: [
      role("pre", "Set-up", [S("liv")]),
      role("during", "FOH & bar", [S("liv")]),
      role("during", "Facilitator", [S("charlotte")]),
      role("post", "Pack-down", [S("liv")]),
    ],
    schedule: [],
    legacyStaffing: ["Charlotte", "Liv"],
    bookTicket: 0, ticketOnly: 25, minOrder: 0, lumaLink: "https://lu.ma/first-chapter", banners: false,
    callSheet: [], callSheetSent: false, salesReportSent: false, mediaCount: 0,
    notes: "Recurring. Standalone (not from a pitch).",
    createdAt: "2026-06-10T10:00:00.000Z",
  },
  {
    id: "ev-history", name: "Local history panel", leadTitle: "Stockport: a people’s history", isbn: "",
    date: daysFromNow(61), time: "18:30", venueId: "ven-simply", venueName: "Simply Books — Bramhall",
    hostId: "host-inhouse", hostName: "In-house (Ben)",
    types: ["Shop Event"], ages: [],
    format: "Three local authors, panel format. No publisher attached — self-produced.",
    status: "Draft", fromPitchId: null,
    roles: [role("pre", "Set-up", []), role("during", "FOH", []), role("post", "Pack-down", [])],
    schedule: [],
    legacyStaffing: [],
    bookTicket: 0, ticketOnly: 0, minOrder: 0, lumaLink: "", banners: false,
    callSheet: [], callSheetSent: false, salesReportSent: false, mediaCount: 0,
    notes: "Idea from a customer. Early — nothing fixed.",
    createdAt: "2026-07-10T10:00:00.000Z",
  },
];

const eventsOfVenue = (venueId: string) => EVENTS.filter((e) => e.venueId === venueId).map((e) => e.id);
const eventsOfHost = (hostId: string) => EVENTS.filter((e) => e.hostId === hostId).map((e) => e.id);

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
    return VENUES_FULL.map((v) => ({ id: v.id, name: v.name, locations: v.locations }));
  },
  async listImprints() {
    return [...IMPRINTS];
  },

  // --- Phase 2: Events ---
  async listEvents() {
    return EVENTS.map((e) => ({ ...e }));
  },
  async getEvent(id) {
    const e = EVENTS.find((x) => x.id === id);
    return e ? { ...e } : null;
  },
  async createEvent(input) {
    const venue = VENUES_FULL.find((v) => v.id === input.venueId);
    const host = HOSTS.find((h) => h.id === input.hostId);
    const event: ShowEvent = {
      ...input,
      id: `ev-${seq++}`,
      venueName: venue?.name ?? "",
      hostName: host?.name ?? "",
      legacyStaffing: [],
      callSheet: [],
      mediaCount: 0,
      createdAt: new Date().toISOString(),
    };
    EVENTS.unshift(event);
    return { ...event };
  },
  async updateEvent(id, input) {
    const i = EVENTS.findIndex((e) => e.id === id);
    if (i === -1) throw new Error("Event not found");
    const merged = { ...EVENTS[i], ...input } as ShowEvent;
    if (input.venueId !== undefined) merged.venueName = VENUES_FULL.find((v) => v.id === input.venueId)?.name ?? "";
    if (input.hostId !== undefined) merged.hostName = HOSTS.find((h) => h.id === input.hostId)?.name ?? "";
    EVENTS[i] = merged;
    return { ...merged };
  },
  async deleteEvent(id) {
    const i = EVENTS.findIndex((e) => e.id === id);
    if (i !== -1) EVENTS.splice(i, 1);
  },

  // --- Phase 2: Venues ---
  async listVenuesFull() {
    return VENUES_FULL.map((v) => ({ ...v, eventIds: eventsOfVenue(v.id) }));
  },
  async getVenue(id) {
    const v = VENUES_FULL.find((x) => x.id === id);
    return v ? { ...v, eventIds: eventsOfVenue(v.id) } : null;
  },
  async createVenue(input) {
    const venue: Venue = { ...input, id: `ven-${seq++}`, techSpec: [], photo: [], eventIds: [] };
    VENUES_FULL.unshift(venue);
    return { ...venue };
  },
  async updateVenue(id, input) {
    const i = VENUES_FULL.findIndex((v) => v.id === id);
    if (i === -1) throw new Error("Venue not found");
    VENUES_FULL[i] = { ...VENUES_FULL[i], ...input } as Venue;
    const changed = VENUES_FULL[i];
    for (const e of EVENTS) if (e.venueId === id) e.venueName = changed.name;
    return { ...changed, eventIds: eventsOfVenue(id) };
  },

  // --- Phase 2: Hosts ---
  async listHosts() {
    return HOSTS.map((h) => ({ ...h, eventIds: eventsOfHost(h.id) }));
  },
  async getHost(id) {
    const h = HOSTS.find((x) => x.id === id);
    return h ? { ...h, eventIds: eventsOfHost(h.id) } : null;
  },
  async createHost(input) {
    const { teamContactIds, ...rest } = input;
    const host: Host = {
      ...rest,
      id: `host-${seq++}`,
      teamContacts: teamContactIds.map((tid) => ({ id: tid, name: tid.charAt(0).toUpperCase() + tid.slice(1) })),
      eventIds: [],
    };
    HOSTS.unshift(host);
    return { ...host };
  },
  async updateHost(id, input) {
    const i = HOSTS.findIndex((h) => h.id === id);
    if (i === -1) throw new Error("Host not found");
    const { teamContactIds, ...rest } = input;
    const merged = { ...HOSTS[i], ...rest } as Host;
    if (teamContactIds !== undefined) {
      merged.teamContacts = teamContactIds.map((tid) => ({ id: tid, name: tid.charAt(0).toUpperCase() + tid.slice(1) }));
    }
    HOSTS[i] = merged;
    const changed = HOSTS[i];
    for (const e of EVENTS) if (e.hostId === id) e.hostName = changed.name;
    return { ...changed, eventIds: eventsOfHost(id) };
  },
};
