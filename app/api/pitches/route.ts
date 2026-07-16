import { NextRequest, NextResponse } from "next/server";
import { getEventsDataSource } from "@/lib/data/events";
import { can, getSessionUser } from "@/lib/auth";
import { PITCH_PRIORITIES, PITCH_STAGES } from "@/lib/pitching";
import type { PitchInput } from "@/lib/types";

// All raw Status options known to exist in the live table — the API never
// writes a string Airtable doesn't already have as a select option.
const KNOWN_STATUSES = PITCH_STAGES.flatMap((s) => s.raw);

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "pitching:view")) {
    return NextResponse.json({ error: "No pitching access" }, { status: 403 });
  }
  const pitches = await getEventsDataSource().listPitches();
  pitches.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return NextResponse.json({ pitches });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "pitching:edit")) {
    return NextResponse.json({ error: "No pitching edit access" }, { status: 403 });
  }

  const body = await req.json();
  // §3.3: minimal required fields — a pitch is an early-stage record.
  if (!body.authorName?.trim()) {
    return NextResponse.json({ error: "Author name is required" }, { status: 400 });
  }
  if (!body.bookTitle?.trim()) {
    return NextResponse.json({ error: "Book title is required" }, { status: 400 });
  }

  const status = KNOWN_STATUSES.includes(body.status) ? body.status : "Wishlist";
  const priority = PITCH_PRIORITIES.includes(body.priority) ? body.priority : "";

  const input: PitchInput = {
    authorName: body.authorName.trim(),
    bookTitle: body.bookTitle.trim(),
    isbn: body.isbn?.trim() ?? "",
    imprintIds: Array.isArray(body.imprintIds) ? body.imprintIds : [],
    publicationDate: body.publicationDate || null,
    status,
    priority,
    initialHighPriority: !!body.initialHighPriority,
    leadEmail: body.leadEmail?.trim() ?? "",
    publicist: body.publicist?.trim() ?? "",
    publicistEmail: body.publicistEmail?.trim() ?? "",
    proposedVenueIds: Array.isArray(body.proposedVenueIds) ? body.proposedVenueIds : [],
    proposedDates: body.proposedDates ?? "",
    estimatedAudienceSize: body.estimatedAudienceSize ?? "",
    pitchingNotes: body.pitchingNotes ?? "",
    opportunityNotes: body.opportunityNotes ?? "",
    rating: typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5 ? body.rating : null,
    location: body.location ?? null,
  };

  const pitch = await getEventsDataSource().createPitch(input);
  return NextResponse.json({ pitch }, { status: 201 });
}
