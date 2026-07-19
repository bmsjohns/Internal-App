import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { isSalesLive } from "@/lib/data/sales";
import { runSalesSync } from "@/lib/data/sales-live";

// 15-minute sales sync (vercel.json cron). Machine-to-machine: Vercel's
// cron runner sends `Authorization: Bearer ${CRON_SECRET}` automatically
// when that env var is set, so this route sits in PUBLIC_ROUTES — the same
// Clerk exemption the Stripe webhook needed (a gated cron 404s silently
// and the rollup just quietly stops). Admins can also trigger it from a
// logged-in browser session for a manual refresh.

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.get("authorization") ?? "";
  const cronAuthorised = !!secret && header === `Bearer ${secret}`;
  if (!cronAuthorised) {
    const user = await getSessionUser();
    if (!user || !can(user, "team.manage")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  if (!isSalesLive()) {
    return NextResponse.json({ ran: false, note: "Sales integrations not configured; mock data in use." });
  }
  const result = await runSalesSync();
  if (result.errors.length) console.error("dashboard sync errors:", result.errors);
  return NextResponse.json(result);
}
