import { NextRequest, NextResponse } from "next/server";
import { getEventsDataSource } from "@/lib/data/events";
import { can, getSessionUser } from "@/lib/auth";
import { parseHostBody } from "@/lib/events-api";
import type { HostInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:view")) {
    return NextResponse.json({ error: "No events access" }, { status: 403 });
  }
  const host = await getEventsDataSource().getHost((await params).id);
  if (!host) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ host });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:edit")) {
    return NextResponse.json({ error: "No events edit access" }, { status: 403 });
  }
  const body = await req.json();
  const full = parseHostBody(body);
  const input: Partial<HostInput> = {};
  for (const key of Object.keys(full) as (keyof HostInput)[]) {
    if (body[key] !== undefined) (input as any)[key] = full[key];
  }
  if (input.name !== undefined && !input.name) {
    return NextResponse.json({ error: "Host name is required" }, { status: 400 });
  }
  const host = await getEventsDataSource().updateHost((await params).id, input);
  return NextResponse.json({ host });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:edit")) {
    return NextResponse.json({ error: "No events edit access" }, { status: 403 });
  }
  const ds = getEventsDataSource();
  const id = (await params).id;
  const host = await ds.getHost(id);
  if (!host) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (host.eventIds.length > 0) {
    return NextResponse.json({ error: "Reassign this host’s events before deleting them" }, { status: 409 });
  }
  await ds.deleteHost(id);
  return new NextResponse(null, { status: 204 });
}
