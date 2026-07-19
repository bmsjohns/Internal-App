import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getBriefingSource } from "@/lib/data/briefing";
import { getEventsDataSource } from "@/lib/data/events";
import { getClubsDataSource } from "@/lib/data/clubs";
import { getHubDataSource } from "@/lib/data/hub";
import { isStaleDraft } from "@/lib/hub";
import { briefingEvents, todayLondon } from "@/lib/briefing";
import type { VenueKey } from "@/lib/config";
import type { Location } from "@/lib/types";

const LOCATION: Record<VenueKey, Location> = { prologue: "Prologue", simply: "Simply Books" };

// The whole day's briefing in one call. Visible to every logged-in user —
// it's the landing page (spec §9 default assumption) — so events are read
// here server-side rather than via /api/events, which needs events:view.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "briefing.view")) return NextResponse.json({ error: "No briefing access" }, { status: 403 });

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
  const visibleVenues = (Object.keys(LOCATION) as VenueKey[]).filter((venue) => can(user, "briefing.view", LOCATION[venue]));
  const hiddenVenue = { roster: [], tasks: [], slack: [], wrap: null, wrapToday: null, stats: [], opening: { hours: "", note: "" } };
  for (const venue of Object.keys(LOCATION) as VenueKey[]) {
    if (!visibleVenues.includes(venue)) day.venues[venue] = hiddenVenue;
  }
  day.alerts = day.alerts.filter((alert) => alert.loc === "both" || visibleVenues.includes(alert.loc));
  day.milestones = day.milestones.filter((milestone) => milestone.venue === "both" || visibleVenues.includes(milestone.venue));
  // Posting urgent alerts is manager-only (§ access). The client hides the
  // control accordingly; the POST route enforces it server-side too.
  const viewer = { canPostAlert: can(user, "briefing.alerts.manage") };

  // Book Clubs / Ordering Hub attention flags (specs B3 + C2): failed
  // payments and stale drafts surface here so nobody has to remember to
  // check. Permission-scoped; failures never blank the briefing.
  const opsFlags = { failedPayments: 0, staleDrafts: 0, canClubs: can(user, "clubs:view"), canHub: can(user, "hub:view") };
  try {
    if (opsFlags.canClubs) {
      const clubsSource = getClubsDataSource();
      const [clubs, memberships] = await Promise.all([clubsSource.listClubs(), clubsSource.listMemberships()]);
      const visibleClubIds = new Set(clubs.filter((club) => can(user, "clubs.view", club.location)).map((club) => club.id));
      opsFlags.failedPayments = memberships.filter((s) => visibleClubIds.has(s.clubId) && s.status !== "cancelled" && s.payStatus !== "ok").length;
    }
    if (opsFlags.canHub) {
      const lines = (await getHubDataSource().listLines()).filter((line) => !line.account || can(user, "ordering.view", line.account));
      opsFlags.staleDrafts = lines.filter((l) => isStaleDraft(l)).length;
    }
  } catch (e) {
    console.error("briefing ops flags failed", e);
  }

  const visibleEvents = allEvents.filter((event) => !event.location || can(user, "briefing.view", event.location));
  return NextResponse.json({ day, events: briefingEvents(visibleEvents, date), viewer, opsFlags });
}
