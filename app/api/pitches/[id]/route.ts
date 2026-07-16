import { NextRequest, NextResponse } from "next/server";
import { getEventsDataSource } from "@/lib/data/events";
import { can, getSessionUser } from "@/lib/auth";
import { PITCH_PRIORITIES, PITCH_STAGES } from "@/lib/pitching";

type Params = { params: Promise<{ id: string }> };

const KNOWN_STATUSES = PITCH_STAGES.flatMap((s) => s.raw);

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "pitching:view")) {
    return NextResponse.json({ error: "No pitching access" }, { status: 403 });
  }
  const { id } = await params;
  const pitch = await getEventsDataSource().getPitch(id);
  if (!pitch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ pitch });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "pitching:edit")) {
    return NextResponse.json({ error: "No pitching edit access" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  if (body.authorName !== undefined && !body.authorName.trim()) {
    return NextResponse.json({ error: "Author name is required" }, { status: 400 });
  }
  if (body.status !== undefined && !KNOWN_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  }
  if (body.priority !== undefined && body.priority !== "" && !PITCH_PRIORITIES.includes(body.priority)) {
    return NextResponse.json({ error: "Unknown priority" }, { status: 400 });
  }
  if (body.rating !== undefined && body.rating !== null && (typeof body.rating !== "number" || body.rating < 1 || body.rating > 5)) {
    return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
  }
  const ds = getEventsDataSource();
  const existing = await ds.getPitch(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Publisher is read-only in Phase 1 — derived via Imprint once Phase 0 lands.
  delete body.publisherIds;
  delete body.publisherNames;
  const pitch = await ds.updatePitch(id, body);
  return NextResponse.json({ pitch });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "pitching:delete")) {
    return NextResponse.json({ error: "No pitching delete access" }, { status: 403 });
  }
  const { id } = await params;
  const ds = getEventsDataSource();
  const pitch = await ds.getPitch(id);
  if (!pitch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await ds.deletePitch(id);
  return NextResponse.json({ ok: true });
}
