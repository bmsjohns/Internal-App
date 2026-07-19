import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/data";
import { can, getSessionUser } from "@/lib/auth";

const digits = (s: string) => s.replace(/\D/g, "");

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "customers.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const customers = await getDataSource().listCustomers();
  if (!q) return NextResponse.json({ customers });

  // Phone and email are the primary match keys — names collide (spec §11a.3).
  const qDigits = digits(q);
  const matches = customers.filter((c) => {
    if (qDigits.length >= 4 && digits(c.phone).includes(qDigits)) return true;
    if (c.email.toLowerCase().includes(q)) return true;
    return c.name.toLowerCase().includes(q);
  });
  return NextResponse.json({ customers: matches.slice(0, 12) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "customers.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const ds = getDataSource();

  // Warn on likely duplicate phone before creating (spec §11a.3) unless the
  // client explicitly overrides.
  const phone = body.phone?.trim() ?? "";
  if (phone && !body.allowDuplicatePhone) {
    const existing = (await ds.listCustomers()).find(
      (c) => digits(c.phone) && digits(c.phone) === digits(phone)
    );
    if (existing) {
      return NextResponse.json(
        { error: "duplicate-phone", existing },
        { status: 409 }
      );
    }
  }

  const customer = await ds.createCustomer({
    name: body.name.trim(),
    email: body.email?.trim() ?? "",
    phone,
    address: body.address?.trim() ?? "",
    notes: body.notes?.trim() ?? "",
  });
  return NextResponse.json({ customer }, { status: 201 });
}
