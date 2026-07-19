import { NextRequest, NextResponse } from "next/server";
import { getEventsDataSource } from "@/lib/data/events";
import { can, getSessionUser } from "@/lib/auth";
import { parseEventBody } from "@/lib/events-api";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:view")) {
    return NextResponse.json({ error: "No events access" }, { status: 403 });
  }
  const events = await getEventsDataSource().listEvents();
  events.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.time.localeCompare(b.time));
  return NextResponse.json({ events, canEdit: can(user, "events:edit") });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:edit")) {
    return NextResponse.json({ error: "No events edit access" }, { status: 403 });
  }
  const body = await req.json();
  const input = parseEventBody(body);
  if (!input.name) {
    return NextResponse.json({ error: "Name / author is required" }, { status: 400 });
  }
  const event = await getEventsDataSource().createEvent(input);
  return NextResponse.json({ event }, { status: 201 });
}
