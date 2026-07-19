import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/data";
import { can, getSessionUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

async function guard() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "settings.suppliers.manage")) {
    return NextResponse.json({ error: "Settings can only be changed by a manager" }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = await guard();
  if (denied) return denied;
  const { id } = await params;
  const body = await req.json();
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
  }
  const supplier = await getDataSource().updateSupplier(id, body);
  return NextResponse.json({ supplier });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const denied = await guard();
  if (denied) return denied;
  const { id } = await params;
  await getDataSource().deleteSupplier(id);
  return NextResponse.json({ ok: true });
}
