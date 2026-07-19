import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getBriefingSource } from "@/lib/data/briefing";
import type { VenueKey } from "@/lib/config";
import type { Location } from "@/lib/types";

const LOCATION: Record<VenueKey, Location> = { prologue: "Prologue", simply: "Simply Books" };

// Tick/untick a task from the briefing (writes back to Deputy when that's
// the live source — spec §4.2).
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "briefing.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { date, id, done } = await req.json();
  if (typeof date !== "string" || typeof id !== "string" || typeof done !== "boolean") {
    return NextResponse.json({ error: "date, id and done are required" }, { status: 400 });
  }
  const source = getBriefingSource();
  const day = await source.getDay(date);
  const venue = (Object.keys(LOCATION) as VenueKey[]).find((key) => day.venues[key].tasks.some((task) => task.id === id));
  if (!venue) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!can(user, "briefing.view", LOCATION[venue])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await source.setTaskDone(date, id, done);
  return NextResponse.json({ ok: true });
}
