import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { canonicalStatus } from "@/lib/config";
import type { Location, Order, OrderLine, OrderLineInput } from "@/lib/types";

function customerLine(order: Order): OrderLine {
  const key = canonicalStatus(order.status).key;
  const status = key === "needs-ordering" ? "Not yet ordered" : key === "ordered" ? "Ordered" : "Received";
  return {
    id: `customer:${order.id}`,
    bookTitle: order.bookTitle,
    author: order.author,
    isbn: order.isbn,
    publisher: order.publisher,
    imprint: "",
    quantity: order.quantity,
    price: order.price,
    source: "Customer Order",
    sourceRef: order.id,
    location: order.location,
    status,
    fulfillmentMethod: order.specialOrder ? "Email to rep" : "Batchline",
    actionedAt: order.statusLog.at(-1)?.at ?? null,
    actionedBy: order.statusLog.at(-1)?.by ?? "",
    createdAt: order.orderDate,
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ds = getDataSource();
  const [stored, orders, suppliers] = await Promise.all([ds.listOrderLines(), ds.listOrders(), ds.listSuppliers()]);
  return NextResponse.json({
    lines: [...stored, ...orders.map(customerLine)],
    suppliers,
    restockReady: process.env.DATA_SOURCE !== "airtable" || process.env.AIRTABLE_HAS_ORDER_LINES === "true",
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.bookTitle?.trim()) return NextResponse.json({ error: "Book title is required" }, { status: 400 });
  if (!Number.isInteger(body.quantity) || body.quantity < 1) return NextResponse.json({ error: "Quantity must be at least 1" }, { status: 400 });
  if (!["Simply Books", "Prologue"].includes(body.location)) return NextResponse.json({ error: "A valid location is required" }, { status: 400 });
  const input: OrderLineInput = {
    bookTitle: body.bookTitle.trim(),
    author: body.author?.trim() ?? "",
    isbn: body.isbn?.trim() ?? "",
    publisher: body.publisher?.trim() ?? "",
    imprint: body.imprint?.trim() ?? "",
    quantity: body.quantity,
    price: typeof body.price === "number" && body.price >= 0 ? body.price : null,
    source: "Restock",
    sourceRef: null,
    location: body.location as Location,
    status: "Not yet ordered",
    fulfillmentMethod: "Batchline",
  };
  try {
    const line = await getDataSource().createOrderLine(input);
    return NextResponse.json({ line }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Couldn’t add the line" }, { status: 503 });
  }
}
