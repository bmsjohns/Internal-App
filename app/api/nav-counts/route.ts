import { NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getClubsDataSource } from "@/lib/data/clubs";
import { getHubDataSource } from "@/lib/data/hub";
import { getReturnsDataSource } from "@/lib/data/returns";
import { isStaleDraft } from "@/lib/hub";

// Lightweight badge counts for the sidebar's Book clubs / Ordering groups.
// Only computes what the user can actually see; the sidebar throttles calls
// client-side (30s) the same way it does for order counts.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const out: Record<string, number> = {};
  try {
    if (can(user, "clubs:view")) {
      const memberships = await getClubsDataSource().listMemberships();
      out.failedPayments = memberships.filter((s) => s.status !== "cancelled" && s.payStatus !== "ok").length;
    }
    if (can(user, "hub:view")) {
      const [lines, returns] = await Promise.all([
        getHubDataSource().listLines(),
        getReturnsDataSource().listReturns(),
      ]);
      out.drafts = lines.filter((l) => l.state === "draft").length;
      out.staleDrafts = lines.filter((l) => isStaleDraft(l)).length;
      out.pending = lines.filter((l) => l.state === "pending").length;
      out.outstanding = lines.filter((l) => l.state === "ordered").length;
      out.returnsStaging = returns.filter((r) => r.status === "requested").length;
      out.returnsOutstanding = returns.filter((r) => r.status !== "requested" && r.status !== "credit").length;
      out.returnsPick = returns.filter((r) => r.status === "approved").length;
    }
  } catch (e) {
    // Badge counts are decoration — never break the nav over them.
    console.error("nav-counts failed", e);
  }
  return NextResponse.json(out);
}
