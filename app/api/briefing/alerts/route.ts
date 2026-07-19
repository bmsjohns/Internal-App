import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getBriefingSource } from "@/lib/data/briefing";
import type { VenueKey } from "@/lib/config";
import type { Location } from "@/lib/types";

const LOCS = ["both", "prologue", "simply"];
const LEVELS = ["urgent", "heads-up"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const LOCATION: Record<VenueKey, Location> = { prologue: "Prologue", simply: "Simply Books" };

function canManageLocation(user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>, loc: "both" | VenueKey) {
  return loc === "both"
    ? Object.values(LOCATION).every((location) => can(user, "briefing.alerts.manage", location))
    : can(user, "briefing.alerts.manage", LOCATION[loc]);
}

// Alerts are posted and cleared by managers only.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "briefing.alerts.manage")) return NextResponse.json({ error: "Alert management access required" }, { status: 403 });
  const { date, text, loc, level, until } = await req.json();
  if (typeof date !== "string" || !ISO.test(date) || typeof text !== "string" || !text.trim() || !LOCS.includes(loc)) {
    return NextResponse.json({ error: "date, text and loc are required" }, { status: 400 });
  }
  if (!canManageLocation(user, loc)) return NextResponse.json({ error: "No alert access for that location" }, { status: 403 });
  const lvl = LEVELS.includes(level) ? level : "urgent";
  // Accept an end date only if it's a valid ISO date on or after the start.
  const end = typeof until === "string" && ISO.test(until) && until >= date ? until : null;
  const alert = await getBriefingSource().postAlert(date, text.trim(), loc, lvl, end);
  return NextResponse.json({ alert }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "briefing.alerts.manage")) return NextResponse.json({ error: "Alert management access required" }, { status: 403 });
  const date = req.nextUrl.searchParams.get("date");
  const id = req.nextUrl.searchParams.get("id");
  if (!date || !id) return NextResponse.json({ error: "date and id are required" }, { status: 400 });
  const source = getBriefingSource();
  const alert = (await source.getDay(date)).alerts.find((item) => item.id === id);
  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  if (!canManageLocation(user, alert.loc)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await source.dismissAlert(date, id);
  return NextResponse.json({ ok: true });
}
