import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/data";
import { can, canDeleteAt, getSessionUser } from "@/lib/auth";
import { orderedSupplierError } from "@/lib/order-workflow";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ds = getDataSource();
  const order = await ds.getOrder(id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(user, "orders.view", order.location)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const customer = order.customerIds[0] ? await ds.getCustomer(order.customerIds[0]) : null;
  return NextResponse.json({ order, customer });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  if (body.bookTitle !== undefined && !body.bookTitle.trim()) {
    return NextResponse.json({ error: "Book title is required" }, { status: 400 });
  }
  if (body.quantity !== undefined && (!Number.isInteger(body.quantity) || body.quantity < 1)) {
    return NextResponse.json({ error: "Quantity must be a whole number of 1 or more" }, { status: 400 });
  }
  const ds = getDataSource();
  const existing = await ds.getOrder(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!can(user, "orders.manage", existing.location)) return NextResponse.json({ error: "No order editing access at this location" }, { status: 403 });
  if (body.location && body.location !== existing.location && !can(user, "orders.manage", body.location)) return NextResponse.json({ error: "No access at the destination location" }, { status: 403 });
  const workflowError = orderedSupplierError(existing, body);
  if (workflowError) {
    return NextResponse.json({ error: workflowError }, { status: 400 });
  }
  // V3 §5 audit trail: every status change records who and when.
  if (typeof body.status === "string" && body.status !== existing.status) {
    body.statusLog = [
      ...existing.statusLog,
      { at: new Date().toISOString(), by: user.name, status: body.status },
    ];
  } else {
    delete body.statusLog; // never writable directly from the client
  }
  const order = await ds.updateOrder(id, body);
  return NextResponse.json({ order });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ds = getDataSource();
  const order = await ds.getOrder(id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Deleting is manager-only, scoped to the venues they manage (spec §2, §11a.4).
  if (!canDeleteAt(user, order.location)) {
    return NextResponse.json({ error: "Only a manager for this venue can delete orders" }, { status: 403 });
  }
  await ds.deleteOrder(id);
  return NextResponse.json({ ok: true });
}
