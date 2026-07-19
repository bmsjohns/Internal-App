import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getHubDataSource } from "@/lib/data/hub";
import { getClubsDataSource } from "@/lib/data/clubs";
import { getDataSource } from "@/lib/data";

// Flow C (C4): single confirm, NO partial receipts. General staff — receiving
// happens at the delivery door and mustn't bottleneck (C7). The hub owns the
// status; originating records that keep their own status (customer orders)
// get it written back here via the preserved source link.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "ordering.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const lineIds: string[] = Array.isArray(body?.lineIds) ? body.lineIds : [];
  const receipts: { lineId: string; quantity: number }[] = Array.isArray(body?.receipts)
    ? body.receipts.filter((item: any) => typeof item?.lineId === "string" && Number.isFinite(Number(item?.quantity)) && Number(item.quantity) > 0)
      .map((item: any) => ({ lineId: item.lineId, quantity: Math.floor(Number(item.quantity)) }))
    : [];
  if (lineIds.length === 0 && receipts.length === 0) return NextResponse.json({ error: "lineIds or receipts is required" }, { status: 400 });

  const source = getHubDataSource();
  const targets = await Promise.all((receipts.length ? receipts.map((item) => item.lineId) : lineIds).map((id) => source.getLine(id)));
  if (targets.some((line) => !line || !line.account || !can(user, "ordering.manage", line.account))) {
    return NextResponse.json({ error: "One or more lines are outside your location access" }, { status: 403 });
  }
  const received = receipts.length ? await source.receive(receipts, user.name) : await source.markArrived(lineIds, user.name);
  const arrived = received.filter((line) => line.state === "arrived");

  // Write-back (C4). Book Club selections / event stock / school orders
  // simply REFLECT the hub line's state via their stored link — nothing to
  // write. Customer orders have their own live status field, so that one is
  // written: canonical "In store", as an existing Airtable option.
  const orders = getDataSource();
  const clubs = getClubsDataSource();
  const writeBack: string[] = [];
  for (const line of arrived) {
    if (!line.sourceLink) continue;
    try {
      if (line.source === "customer") {
        const order = await orders.getOrder(line.sourceLink);
        if (!order) continue;
        await orders.updateOrder(order.id, {
          status: "Already In Stock",
          statusLog: [...order.statusLog, { at: new Date().toISOString(), by: user.name, status: "Already In Stock" }],
        });
        writeBack.push(order.id);
      } else if (line.source === "bookclub") {
        // Book Orders keeps its own Status column the team already uses —
        // mirror the hub's terminal state as "Received".
        await clubs.updateSelectionOrderStatus(line.sourceLink, "arrived");
        writeBack.push(line.sourceLink);
      }
    } catch (e) {
      console.error(`Hub arrival write-back failed for ${line.source} ${line.sourceLink}`, e);
    }
  }
  return NextResponse.json({ arrived: arrived.length, received: received.length, writeBack });
}
