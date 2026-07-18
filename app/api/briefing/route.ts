import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getBriefingSource } from "@/lib/data/briefing";
import { getEventsDataSource } from "@/lib/data/events";
import { briefingEvents, todayLondon } from "@/lib/briefing";

// The whole day's briefing in one call. Visible to every logged-in user —
// it's the landing page (spec §9 default assumption) — so events are read
// here server-side rather than via /api/events, which needs events:view.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date") || todayLondon();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Bad date" }, { status: 400 });
  }

  const [day, allEvents] = await Promise.all([
    getBriefingSource().getDay(date),
    getEventsDataSource()
      .listEvents()
      .catch(() => []), // events failing must not blank the whole briefing
  ]);
  // Posting urgent alerts is manager-only (§ access). The client hides the
  // control accordingly; the POST route enforces it server-side too.
  const viewer = { canPostAlert: user.role === "manager" };
  return NextResponse.json({ day, events: briefingEvents(allEvents, date), viewer });
}
