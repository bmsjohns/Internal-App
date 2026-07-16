import { NextRequest, NextResponse } from "next/server";
import { getEventsDataSource } from "@/lib/data/events";
import { can, getSessionUser } from "@/lib/auth";
import { eventStaffIds } from "@/lib/events";
import { getStaffDirectory } from "@/lib/staff";

type Params = { params: Promise<{ id: string }> };

/**
 * Day-of call sheet payload (spec §6). Deliberately NOT the full event
 * record: it's the whole-team roster + run of show + the on-the-night facts,
 * readable by the callsheet:view tier — people who are staffed on this event
 * but have no access to the rest of the Events module. Events-module users
 * (events:view) can open any call sheet.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:view") && !can(user, "callsheet:view")) {
    return NextResponse.json({ error: "No call sheet access" }, { status: 403 });
  }
  const ds = getEventsDataSource();
  const event = await ds.getEvent((await params).id);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // callsheet:view sees call sheets for events they're staffed on (§6.2).
  if (!can(user, "events:view") && !eventStaffIds(event).has(user.id)) {
    return NextResponse.json({ error: "You're not on this event's team" }, { status: 403 });
  }

  const [venue, host, staff] = await Promise.all([
    event.venueId ? ds.getVenue(event.venueId) : null,
    event.hostId ? ds.getHost(event.hostId) : null,
    getStaffDirectory(),
  ]);
  return NextResponse.json({
    callSheet: {
      id: event.id,
      name: event.name,
      leadTitle: event.leadTitle,
      date: event.date,
      time: event.time,
      status: event.status,
      venueName: venue?.name ?? event.venueName,
      venueLocation: venue?.locations.join(", ") ?? "",
      venueCapacity: venue?.capacity ?? "",
      venueNotes: venue?.notes ?? "",
      hostName: host?.name ?? event.hostName,
      hostPhone: host?.phone ?? "",
      roles: event.roles,
      schedule: event.schedule,
      notes: event.notes,
      me: user.id,
      staff,
    },
  });
}
