import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { matchTeamMember, DEFAULT_LOCATION } from "@/lib/config";
import type { OrderInput } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ds = getDataSource();
  const [orders, customers] = await Promise.all([ds.listOrders(), ds.listCustomers()]);
  const byId = new Map(customers.map((c) => [c.id, c]));
  const joined = orders
    .map((o) => {
      const c = byId.get(o.customerIds[0]);
      return { ...o, customerName: o.customerName ?? c?.name, customerPhone: o.customerPhone ?? c?.phone };
    })
    .sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1));
  return NextResponse.json({ orders: joined });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.bookTitle?.trim()) {
    return NextResponse.json({ error: "Book title is required" }, { status: 400 });
  }

  const input: OrderInput = {
    bookTitle: body.bookTitle.trim(),
    author: body.author?.trim() ?? "",
    isbn: body.isbn?.trim() ?? "",
    customerIds: body.customerIds ?? [],
    // Team Member is set from the logged-in user, not a picker (spec §6,
    // option b). Falls back to blank if their name isn't an existing option.
    teamMember: matchTeamMember(user.name) ?? "",
    paid: body.paid ?? "Not Paid",
    status: body.status ?? "Not Ordered",
    specialOrder: !!body.specialOrder,
    isPreorder: !!body.isPreorder,
    preorderPublicationDate: body.isPreorder ? (body.preorderPublicationDate || null) : null,
    estimatedLeadTime: body.estimatedLeadTime || null,
    deliveryMethod: body.deliveryMethod ?? "Collection",
    location: body.location ?? DEFAULT_LOCATION,
    notes: body.notes ?? "",
  };

  const order = await getDataSource().createOrder(input);
  return NextResponse.json({ order }, { status: 201 });
}
