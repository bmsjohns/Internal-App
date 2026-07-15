import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/data";
import { can, getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const suppliers = await getDataSource().listSuppliers();
  return NextResponse.json({ suppliers });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "settings:manage")) {
    return NextResponse.json({ error: "Settings can only be changed by a manager" }, { status: 403 });
  }
  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
  }
  const supplier = await getDataSource().createSupplier({
    name: body.name.trim(),
    cadence: body.cadence?.trim() ?? "",
    accountNumber: body.accountNumber?.trim() ?? "",
  });
  return NextResponse.json({ supplier }, { status: 201 });
}
