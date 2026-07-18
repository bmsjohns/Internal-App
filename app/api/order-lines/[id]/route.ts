import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import type { OrderInput, OrderLineStatus } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };
const statuses: OrderLineStatus[] = ["Not yet ordered", "Ordered", "Received"];

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = decodeURIComponent((await params).id);
  const body = await req.json();
  if (body.status !== undefined && !statuses.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const ds = getDataSource();
  const actioned = body.status === "Ordered" || body.status === "Received";
  if (id.startsWith("customer:")) {
    const orderId = id.slice("customer:".length);
    const order = await ds.getOrder(orderId);
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const input: Partial<OrderInput> = {};
    if (body.quantity !== undefined && Number.isInteger(body.quantity) && body.quantity > 0) input.quantity = body.quantity;
    if (body.status !== undefined) {
      // Customer Orders use the existing Orders select options; "Already In
      // Stock" is the received equivalent and avoids inventing an Airtable option.
      const status = body.status === "Received" ? "Already In Stock" : body.status === "Ordered" ? "Ordered" : "Not Ordered";
      input.status = status;
      input.statusLog = [...order.statusLog, { at: new Date().toISOString(), by: user.name, status }];
    }
    const updated = await ds.updateOrder(orderId, input);
    return NextResponse.json({ id, status: body.status, actionedAt: updated.statusLog.at(-1)?.at, actionedBy: user.name });
  }
  try {
    const line = await ds.updateOrderLine(id, {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.quantity !== undefined && Number.isInteger(body.quantity) && body.quantity > 0 ? { quantity: body.quantity } : {}),
      ...(body.status !== undefined ? { actionedAt: actioned ? new Date().toISOString() : null, actionedBy: actioned ? user.name : "" } : {}),
    });
    return NextResponse.json({ line });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 404 });
  }
}
