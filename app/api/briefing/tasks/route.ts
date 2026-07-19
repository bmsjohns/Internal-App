import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getBriefingSource } from "@/lib/data/briefing";

// Tick/untick a task from the briefing (writes back to Deputy when that's
// the live source — spec §4.2).
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { date, id, done } = await req.json();
  if (typeof date !== "string" || typeof id !== "string" || typeof done !== "boolean") {
    return NextResponse.json({ error: "date, id and done are required" }, { status: 400 });
  }
  await getBriefingSource().setTaskDone(date, id, done);
  return NextResponse.json({ ok: true });
}
