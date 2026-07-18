import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getClubsDataSource } from "@/lib/data/clubs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "clubs:view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const src = getClubsDataSource();
  const member = await src.getMember(id);
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  const payments = await src.getPaymentHistory(id);
  return NextResponse.json({ member, payments });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "clubs:manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const patch: Record<string, string> = {};
  for (const k of ["name", "email", "phone", "address", "notes"] as const) {
    if (typeof body[k] === "string") patch[k] = body[k];
  }
  const member = await getClubsDataSource().updateMember(id, patch);
  return NextResponse.json({ member });
}
