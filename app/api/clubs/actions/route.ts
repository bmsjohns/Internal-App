import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getClubsDataSource } from "@/lib/data/clubs";

// Stripe write actions (spec B2) — cancel / pause / resume / move. All
// logged who+when on the membership; refunds deliberately absent (view-only
// in v1, issued in the Stripe dashboard).
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "clubs:manage")) {
    return NextResponse.json({ error: "Managing subscriptions needs the clubs:manage permission" }, { status: 403 });
  }
  const body = await req.json();
  const { action, membershipId } = body ?? {};
  if (!membershipId) return NextResponse.json({ error: "membershipId is required" }, { status: 400 });
  const src = getClubsDataSource();
  try {
    if (action === "cancel") {
      const when = body.when === "now" ? "now" : "period_end";
      return NextResponse.json({ membership: await src.cancelMembership(membershipId, when, user.name) });
    }
    if (action === "pause") {
      return NextResponse.json({ membership: await src.pauseMembership(membershipId, user.name) });
    }
    if (action === "resume") {
      return NextResponse.json({ membership: await src.resumeMembership(membershipId, user.name) });
    }
    if (action === "move") {
      if (!body.targetClubId) return NextResponse.json({ error: "targetClubId is required" }, { status: 400 });
      return NextResponse.json({ membership: await src.moveMembership(membershipId, body.targetClubId, user.name) });
    }
    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Action failed" }, { status: 500 });
  }
}
