import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/data";
import { canDeleteAt, getSessionUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ds = getDataSource();
  const order = await ds.getOrder(id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  const ds = getDataSource();
  if (!(await ds.getOrder(id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
