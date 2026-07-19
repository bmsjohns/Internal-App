import { NextRequest, NextResponse } from "next/server";
import { getEventsDataSource } from "@/lib/data/events";
import { can, getSessionUser, isAdmin } from "@/lib/auth";
import { parseVenueBody } from "@/lib/events-api";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:view")) {
    return NextResponse.json({ error: "No events access" }, { status: 403 });
  }
  const venues = await getEventsDataSource().listVenuesFull();
  return NextResponse.json({ venues, canEdit: isAdmin(user) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "No events edit access" }, { status: 403 });
  }
  const input = parseVenueBody(await req.json());
  if (!input.name) return NextResponse.json({ error: "Venue name is required" }, { status: 400 });
  const venue = await getEventsDataSource().createVenue(input);
  return NextResponse.json({ venue }, { status: 201 });
}
