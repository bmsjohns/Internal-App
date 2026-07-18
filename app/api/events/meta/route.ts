import { NextResponse } from "next/server";
import { getEventsDataSource } from "@/lib/data/events";
import { hasEventLocationField, hasPhase2Schema } from "@/lib/data/events-airtable";
import { can, getSessionUser } from "@/lib/auth";
import { getStaffDirectory } from "@/lib/staff";
import { AGE_GROUP_OPTIONS, EVENT_TYPE_OPTIONS } from "@/lib/events";

/** Everything the event editor needs in one round trip. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:view")) {
    return NextResponse.json({ error: "No events access" }, { status: 403 });
  }
  const ds = getEventsDataSource();
  const [staff, venues, hosts] = await Promise.all([getStaffDirectory(), ds.listVenuesFull(), ds.listHosts()]);
  return NextResponse.json({
    me: { id: user.id, name: user.name },
    canEdit: can(user, "events:edit"),
    staff,
    venues: venues.map((v) => ({ id: v.id, name: v.name, capacity: v.capacity, locations: v.locations })),
    hosts: hosts.map((h) => ({ id: h.id, name: h.name, fee: h.fee, phone: h.phone })),
    eventTypes: EVENT_TYPE_OPTIONS,
    ageGroups: AGE_GROUP_OPTIONS,
    // False while the live base is pre-migration: the UI shows the running
    // order / staffing editors read-only instead of losing edits.
    schemaReady: process.env.DATA_SOURCE !== "airtable" || hasPhase2Schema(),
    eventLocationReady: process.env.DATA_SOURCE !== "airtable" || hasEventLocationField(),
  });
}
