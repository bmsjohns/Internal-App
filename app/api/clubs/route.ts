import { NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getClubsDataSource } from "@/lib/data/clubs";
import { getHubDataSource } from "@/lib/data/hub";
import type { HubLineState } from "@/lib/types";

// One payload for every Book Clubs screen: clubs, members, the membership
// join table and selections. Small data (30 clubs / a few hundred members)
// — a single fetch beats four chatty ones, and the client filters/sorts
// locally per the A2 data bar.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "clubs:view")) {
    return NextResponse.json({ error: "Book Clubs access hasn't been granted to your account" }, { status: 403 });
  }
  const clubs = getClubsDataSource();
  const hub = getHubDataSource();
  const [clubList, members, memberships, selections, hubLines, publishers] = await Promise.all([
    clubs.listClubs(),
    clubs.listMembers(),
    clubs.listMemberships(),
    clubs.listSelections(),
    hub.listLines(),
    hub.listPublishers(),
  ]);
  // Order status is REFLECTED from the hub line (B4) — resolved server-side
  // so club screens never need hub permissions.
  const stateOf = new Map(hubLines.map((l) => [l.id, l.state]));
  const withState = selections.map((s) => ({
    ...s,
    orderState: (s.hubLineId ? (stateOf.get(s.hubLineId) ?? "arrived") : null) as HubLineState | null,
  }));
  return NextResponse.json({
    clubs: clubList,
    members,
    memberships,
    selections: withState,
    // Publisher options for the pick form (id/name/imprints only — rates and
    // account numbers stay behind hub:view).
    publisherOptions: publishers.map((p) => ({ id: p.id, name: p.name, imprints: p.imprints })),
    canManage: can(user, "clubs:manage"),
  });
}
