import { NextRequest, NextResponse } from "next/server";
import { getEventsDataSource } from "@/lib/data/events";
import { can, getSessionUser } from "@/lib/auth";
import { parseEventBody, parseRoles, parseSchedule } from "@/lib/events-api";
import type { ShowEventInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:view")) {
    return NextResponse.json({ error: "No events access" }, { status: 403 });
  }
  const event = await getEventsDataSource().getEvent((await params).id);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ event });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:edit")) {
    return NextResponse.json({ error: "No events edit access" }, { status: 403 });
  }
  const body = await req.json();
  // Partial update: only touch the keys the client sent (optimistic tab
  // saves send small payloads — a schedule change must not blank the name).
  const full = parseEventBody(body);
  const input: Partial<ShowEventInput> = {};
  for (const key of Object.keys(full) as (keyof ShowEventInput)[]) {
    if (body[key] !== undefined) (input as any)[key] = full[key];
  }
  if (body.roles !== undefined) input.roles = parseRoles(body.roles);
  if (body.schedule !== undefined) input.schedule = parseSchedule(body.schedule);
  if (input.name !== undefined && !input.name) {
    return NextResponse.json({ error: "Name / author is required" }, { status: 400 });
  }
  const event = await getEventsDataSource().updateEvent((await params).id, input);
  return NextResponse.json({ event });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:edit")) {
    return NextResponse.json({ error: "No events edit access" }, { status: 403 });
  }
  await getEventsDataSource().deleteEvent((await params).id);
  return NextResponse.json({ ok: true });
}
