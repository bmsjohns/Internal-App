import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/data";
import { can, getSessionUser } from "@/lib/auth";
import { matchTeamMember, DEFAULT_LOCATION, TEAM_MEMBER_OPTIONS } from "@/lib/config";
import { LOCATIONS, type OrderInput } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "orders.view")) return NextResponse.json({ error: "No orders access" }, { status: 403 });

  const ds = getDataSource();
  const [orders, customers] = await Promise.all([ds.listOrders(), ds.listCustomers()]);
  const byId = new Map(customers.map((c) => [c.id, c]));
  const joined = orders
    .filter((order) => can(user, "orders.view", order.location))
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
  const location = LOCATIONS.includes(body.location) ? body.location : DEFAULT_LOCATION;
  if (!can(user, "orders.manage", location)) return NextResponse.json({ error: "No order editing access at this location" }, { status: 403 });
  if (!body.bookTitle?.trim()) {
    return NextResponse.json({ error: "Book title is required" }, { status: 400 });
  }

  // V3 §6: default to the logged-in user, but an explicit pick of another
  // team member (ordering on someone's behalf) is allowed if it's a real
  // option — never write a string Airtable doesn't know.
  const pickedMember =
    typeof body.teamMember === "string" && TEAM_MEMBER_OPTIONS.includes(body.teamMember)
      ? body.teamMember
      : null;

  const status = body.status ?? "Not Ordered";
  const quantity = Number.isInteger(body.quantity) && body.quantity > 0 ? body.quantity : 1;

  const input: OrderInput = {
    bookTitle: body.bookTitle.trim(),
    author: body.author?.trim() ?? "",
    isbn: body.isbn?.trim() ?? "",
    customerIds: body.customerIds ?? [],
    teamMember: pickedMember ?? matchTeamMember(user.name) ?? "",
    paid: body.paid ?? "Not Paid",
    status,
    publisher: body.publisher?.trim() ?? "",
    price: typeof body.price === "number" && body.price >= 0 ? body.price : null,
    quantity,
    statusLog: [{ at: new Date().toISOString(), by: user.name, status }],
    specialOrder: !!body.specialOrder,
    isPreorder: !!body.isPreorder,
    preorderPublicationDate: body.isPreorder ? (body.preorderPublicationDate || null) : null,
    estimatedLeadTime: body.estimatedLeadTime || null,
    deliveryMethod: body.deliveryMethod ?? "Collection",
    location,
    notes: body.notes ?? "",
  };

  const order = await getDataSource().createOrder(input);
  return NextResponse.json({ order }, { status: 201 });
}
