import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getBriefingSource } from "@/lib/data/briefing";

// Spec §7 v1: whoever compiles the wrap-up writes it here, saved against the
// date it covers; a published wrap surfaces on the NEXT day's briefing. A
// draft (`draft: true`) is the shared work-in-progress saved through the day
// and stays off the next day's briefing until published. Whether publishing
// should also auto-post to Slack is an open question for Ben (spec §7).
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { date, venue, headline, body, draft } = await req.json();
  if (
    typeof date !== "string" ||
    !["prologue", "simply"].includes(venue) ||
    typeof body !== "string" ||
    !body.trim()
  ) {
    return NextResponse.json({ error: "date, venue and body are required" }, { status: 400 });
  }
  const postedAt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(":", ".");
  const wrap = {
    headline: typeof headline === "string" && headline.trim() ? headline.trim() : body.trim().slice(0, 80),
    body: body.trim(),
    byline: user.name.split(/\s+/)[0],
    postedAt,
  };
  await getBriefingSource().saveWrap(date, venue, wrap, draft === true);
  return NextResponse.json({ wrap, draft: draft === true }, { status: 201 });
}
