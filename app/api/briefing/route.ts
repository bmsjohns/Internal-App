import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getBriefingSource } from "@/lib/data/briefing";
import { getEventsDataSource } from "@/lib/data/events";
import { getClubsDataSource } from "@/lib/data/clubs";
import { getHubDataSource } from "@/lib/data/hub";
import { isStaleDraft } from "@/lib/hub";
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

  // Book Clubs / Ordering Hub attention flags (specs B3 + C2): failed
  // payments and stale drafts surface here so nobody has to remember to
  // check. Permission-scoped; failures never blank the briefing.
  const opsFlags = { failedPayments: 0, staleDrafts: 0, canClubs: can(user, "clubs:view"), canHub: can(user, "hub:view") };
  try {
    if (opsFlags.canClubs) {
      const memberships = await getClubsDataSource().listMemberships();
      opsFlags.failedPayments = memberships.filter((s) => s.status !== "cancelled" && s.payStatus !== "ok").length;
    }
    if (opsFlags.canHub) {
      const lines = await getHubDataSource().listLines();
      opsFlags.staleDrafts = lines.filter((l) => isStaleDraft(l)).length;
    }
  } catch (e) {
    console.error("briefing ops flags failed", e);
  }

  return NextResponse.json({ day, events: briefingEvents(allEvents, date), viewer, opsFlags });
}
