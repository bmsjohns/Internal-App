import { NextRequest, NextResponse } from "next/server";
import { getEventsDataSource } from "@/lib/data/events";
import { can, getSessionUser, isAdmin } from "@/lib/auth";
import { parseVenueBody } from "@/lib/events-api";
import type { VenueInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:view")) {
    return NextResponse.json({ error: "No events access" }, { status: 403 });
  }
  const venue = await getEventsDataSource().getVenue((await params).id);
  if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ venue });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "No events edit access" }, { status: 403 });
  }
  const body = await req.json();
  const full = parseVenueBody(body);
  const input: Partial<VenueInput> = {};
  for (const key of Object.keys(full) as (keyof VenueInput)[]) {
    if (body[key] !== undefined) (input as any)[key] = full[key];
  }
  if (input.name !== undefined && !input.name) {
    return NextResponse.json({ error: "Venue name is required" }, { status: 400 });
  }
  const venue = await getEventsDataSource().updateVenue((await params).id, input);
  return NextResponse.json({ venue });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "No events edit access" }, { status: 403 });
  }
  const ds = getEventsDataSource();
  const id = (await params).id;
  const venue = await ds.getVenue(id);
  if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (venue.eventIds.length > 0) {
    return NextResponse.json({ error: "Move or delete this venue’s events before deleting it" }, { status: 409 });
  }
  await ds.deleteVenue(id);
  return new NextResponse(null, { status: 204 });
}
