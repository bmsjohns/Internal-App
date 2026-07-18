import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";

// Full-history order search: unlike GET /api/orders (open + recent window),
// this matches against every order in the base, however old.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ orders: [] });

  const ds = getDataSource();
  const [orders, customers] = await Promise.all([ds.searchOrders(q), ds.listCustomers()]);
  const byId = new Map(customers.map((c) => [c.id, c]));
  const joined = orders
    .map((o) => {
      const c = byId.get(o.customerIds[0]);
      return { ...o, customerName: o.customerName ?? c?.name, customerPhone: o.customerPhone ?? c?.phone };
    })
    .sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1));
  return NextResponse.json({ orders: joined });
}
