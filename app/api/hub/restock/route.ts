import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getHubDataSource } from "@/lib/data/hub";
import { LOCATIONS } from "@/lib/types";

// Restock capture + hand-off (C5). Deliberately low-friction: general staff,
// no extra permission tier — the value is in people actually logging things.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "hub:view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const hub = getHubDataSource();
  try {
    if (body?.action === "handle") {
      if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
      return NextResponse.json({ item: await hub.handleRestock(body.id, user.name) });
    }
    // default: add a capture
    if (!body?.title?.trim()) return NextResponse.json({ error: "Title (or a scanned ISBN) is required" }, { status: 400 });
    const item = await hub.addRestock({
      title: String(body.title).trim(),
      isbn: String(body.isbn ?? "").trim(),
      quantity: Math.max(1, Math.floor(Number(body.quantity) || 1)),
      location: LOCATIONS.includes(body.location) ? body.location : "Prologue",
      by: user.name,
      supplier: String(body.supplier ?? "").trim(),
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Action failed" }, { status: 400 });
  }
}
