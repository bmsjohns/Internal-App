import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getBriefingSource } from "@/lib/data/briefing";

const LOCS = ["both", "prologue", "simply"];

// Urgent alerts are posted and cleared by managers only.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "manager") return NextResponse.json({ error: "Managers only" }, { status: 403 });
  const { date, text, loc } = await req.json();
  if (typeof date !== "string" || typeof text !== "string" || !text.trim() || !LOCS.includes(loc)) {
    return NextResponse.json({ error: "date, text and loc are required" }, { status: 400 });
  }
  const alert = await getBriefingSource().postAlert(date, text.trim(), loc);
  return NextResponse.json({ alert }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "manager") return NextResponse.json({ error: "Managers only" }, { status: 403 });
  const date = req.nextUrl.searchParams.get("date");
  const id = req.nextUrl.searchParams.get("id");
  if (!date || !id) return NextResponse.json({ error: "date and id are required" }, { status: 400 });
  await getBriefingSource().dismissAlert(date, id);
  return NextResponse.json({ ok: true });
}
