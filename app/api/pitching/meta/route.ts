import { NextResponse } from "next/server";
import { getEventsDataSource } from "@/lib/data/events";
import { can, getSessionUser } from "@/lib/auth";

// Picker options for the pitch form: venues (select-only in Phase 1, §6)
// and imprints (the primary link point, §3.2).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "pitching:view")) {
    return NextResponse.json({ error: "No pitching access" }, { status: 403 });
  }
  const ds = getEventsDataSource();
  const [venues, imprints] = await Promise.all([ds.listVenues(), ds.listImprints()]);
  return NextResponse.json({ venues, imprints });
}
