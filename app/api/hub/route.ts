import { NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getHubDataSource } from "@/lib/data/hub";
import { getDataSource } from "@/lib/data";

// One payload for every Ordering Hub screen: lines (all states), publishers
// (reference data incl. rates + account numbers) and the restock list, plus
// the Settings suppliers so restock groups can show ordering cadence (C5).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "hub:view")) {
    return NextResponse.json({ error: "Ordering Hub access hasn't been granted to your account" }, { status: 403 });
  }
  const hub = getHubDataSource();
  const [lines, publishers, restock, suppliers] = await Promise.all([
    hub.listLines(),
    hub.listPublishers(),
    hub.listRestock(),
    getDataSource().listSuppliers().catch(() => []),
  ]);
  return NextResponse.json({
    lines,
    publishers,
    restock,
    suppliers,
    canSend: can(user, "hub:send"),
    canEditPublishers: can(user, "settings:manage"),
    userName: user.name,
  });
}
