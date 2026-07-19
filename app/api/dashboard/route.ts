import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import type { Location } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";
import type { VenueKey } from "@/lib/config";
import { VENUES, venueKeyOf } from "@/lib/config";
import { todayLondon } from "@/lib/briefing";
import { getDataSource } from "@/lib/data";
import { getClubsDataSource } from "@/lib/data/clubs";
import { getHubDataSource } from "@/lib/data/hub";
import { getReturnsDataSource } from "@/lib/data/returns";
import { getEventsDataSource } from "@/lib/data/events";
import { getBriefingSource } from "@/lib/data/briefing";
import { getSalesDataSource, isSalesLive } from "@/lib/data/sales";
import { getLiveLumaPreview, isLumaLive } from "@/lib/luma";
import { getEventOperationsPreview } from "@/lib/event-operations";
import {
  buildOpsCards,
  buildTiles,
  buildTrendCards,
  paceOf,
  type DashboardOpsCard,
  type DashboardPayload,
  type DashboardTile,
  type PaceEntry,
} from "@/lib/dashboard";

// Management Dashboard aggregation: one call returns the whole page. Reads
// go through each module's existing seam (each already behind its own 30s
// server cache), so this is query-on-demand — no aggregation table (see the
// note at the bottom of lib/dashboard.ts). Every section degrades
// independently: a failing seam empties its card, never 500s the page.

// Tiles/cards only include what the viewer could open themselves — same
// posture as /api/nav-counts.
const TILE_PERMISSION: Record<DashboardTile["key"], string> = {
  "returns-pick": "returns.view",
  "orders-today": "orders.view",
  "failed-payments": "clubs.view",
  "hub-drafts": "ordering.view",
  "events-week": "events.view",
  pitches: "events.pitching.view",
};

const OPS_PERMISSION: Record<DashboardOpsCard["key"], string> = {
  orders: "orders.view",
  hub: "ordering.view",
  returns: "returns.view",
  clubs: "clubs.view",
  events: "events.view",
  restock: "ordering.view",
  staffing: "briefing.view",
};

const quiet = async <T>(label: string, promise: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await promise;
  } catch (e) {
    console.error(`dashboard: ${label} failed`, e);
    return fallback;
  }
};

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "dashboard.view")) return NextResponse.json({ error: "No dashboard access" }, { status: 403 });

  const requested = req.nextUrl.searchParams.get("venue");
  const requestedLoc: Location | null =
    requested === "simply" ? "Simply Books" : requested === "prologue" ? "Prologue" : null;
  // Location scope = what the viewer may see ∩ what they asked to see.
  const visible = LOCATIONS.filter(
    (loc) => can(user, "dashboard.view", loc) && (!requestedLoc || loc === requestedLoc)
  );
  if (visible.length === 0) return NextResponse.json({ error: "No location access" }, { status: 403 });

  const today = todayLondon();
  const inLoc = (loc: Location | null | undefined) => loc == null || visible.includes(loc);

  const clubsSource = getClubsDataSource();
  const hubSource = getHubDataSource();

  const [sales, orders, clubs, memberships, members, hubLines, publishers, restock, returns, events, pitches, briefingDay] =
    await Promise.all([
      quiet("sales", getSalesDataSource().getSales(today), null),
      can(user, "orders.view") ? quiet("orders", getDataSource().listOrders(), []) : [],
      can(user, "clubs.view") ? quiet("clubs", clubsSource.listClubs(), []) : [],
      can(user, "clubs.view") ? quiet("memberships", clubsSource.listMemberships(), []) : [],
      can(user, "clubs.view") ? quiet("members", clubsSource.listMembers(), []) : [],
      can(user, "ordering.view") ? quiet("hub lines", hubSource.listLines(), []) : [],
      quiet("publishers", hubSource.listPublishers(), []),
      can(user, "ordering.view") ? quiet("restock", hubSource.listRestock(), []) : [],
      can(user, "returns.view") ? quiet("returns", getReturnsDataSource().listReturns(), []) : [],
      can(user, "events.view") ? quiet("events", getEventsDataSource().listEvents(), []) : [],
      can(user, "events.pitching.view") ? quiet("pitches", getEventsDataSource().listPitches(), []) : [],
      can(user, "briefing.view") ? quiet("briefing", getBriefingSource().getDay(today), null) : null,
    ]);

  const publisherMap = new Map(publishers.map((p) => [p.id, p] as const));
  const scopedOrders = orders.filter((o) => inLoc(o.location));
  const scopedReturns = returns.filter((r) => inLoc(r.location));
  const scopedHubDrafts = hubLines.filter((l) => l.state === "draft" && inLoc(l.account));
  const scopedRestock = restock.filter((r) => inLoc(r.location));

  // Pre-sale pace: events in the next 7 days. Live Luma is one API call per
  // event, so cap it and fall back to the deterministic preview per event.
  // Owning-shop scoping: the Location field is pre-migration null on most
  // events, so fall back to the venue name (same inference buildLuma uses).
  const eventLoc = (ev: (typeof events)[number]): Location | null =>
    ev.location ??
    (ev.venueName.includes("Simply") ? "Simply Books" : ev.venueName.includes("Prologue") ? "Prologue" : null);
  const horizon = new Date(new Date(`${today}T12:00:00`).getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const upcoming = events
    .filter((ev) => ev.date >= today && ev.date <= horizon && inLoc(eventLoc(ev)) && ev.status.toLowerCase() !== "cancelled")
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 8);
  const weekEvents: PaceEntry[] = await Promise.all(
    upcoming.map(async (ev) => {
      const preview = getEventOperationsPreview(ev).luma;
      const luma =
        isLumaLive() && ev.lumaLink ? await quiet(`luma ${ev.id}`, getLiveLumaPreview(ev), preview) : preview;
      return paceOf(ev, luma, today);
    })
  );

  const visibleVenueKeys = visible.map((loc) => venueKeyOf(loc));
  const roster = briefingDay
    ? (["prologue", "simply"] as VenueKey[])
        .filter((venue) => visibleVenueKeys.includes(venue) && can(user, "briefing.view", VENUES[venue].label))
        .map((venue) => ({
          venue,
          entries: briefingDay.venues[venue].roster,
          hours: briefingDay.venues[venue].opening.hours,
        }))
    : null;

  const tiles = buildTiles({
    returns: scopedReturns,
    orders: scopedOrders,
    memberships,
    clubs,
    visible,
    hubDrafts: scopedHubDrafts,
    publishers: publisherMap,
    weekEvents,
    pitches: pitches.filter((p) => inLoc(p.location)),
  }).filter((t) => can(user, TILE_PERMISSION[t.key]));

  const ops = buildOpsCards({
    orders: scopedOrders,
    hubDrafts: scopedHubDrafts,
    publishers: publisherMap,
    returns: scopedReturns,
    memberships,
    clubs,
    members,
    visible,
    weekEvents,
    restock: scopedRestock,
    roster,
  }).filter((c) => can(user, OPS_PERMISSION[c.key]));

  const trends = buildTrendCards({
    memberships,
    clubs,
    visible,
    orders: scopedOrders,
    returns: scopedReturns,
    publishers: publisherMap,
    hubLines: hubLines.filter((l) => inLoc(l.account)),
    today,
  }).filter((t) =>
    t.key === "membership" ? can(user, "clubs.view")
    : t.key === "turnaround" ? can(user, "orders.view")
    : t.key === "returns-value" ? can(user, "returns.view")
    : can(user, "ordering.view")
  );

  // Sales in display order (Prologue first, matching the design), visible
  // venues only.
  const salesReports = sales
    ? (["prologue", "simply"] as VenueKey[]).filter((v) => visibleVenueKeys.includes(v)).map((v) => sales[v])
    : [];

  const payload: DashboardPayload = {
    date: today,
    salesSample: !isSalesLive(),
    sales: salesReports,
    tiles,
    ops,
    trends,
  };
  return NextResponse.json(payload);
}
