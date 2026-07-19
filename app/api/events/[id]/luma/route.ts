import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getEventsDataSource } from "@/lib/data/events";
import { getEventOperationsPreview } from "@/lib/event-operations";
import { createLumaEvent, getLiveLumaPreview, isLumaLive, LumaApiError, validateLumaEventUrl } from "@/lib/luma";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:edit")) return NextResponse.json({ error: "No events edit access" }, { status: 403 });
  if (!isLumaLive()) return NextResponse.json({ error: "Luma live mode is not configured." }, { status: 503 });

  const source = getEventsDataSource();
  const event = await source.getEvent((await params).id);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await req.json() as { action?: string; calendarId?: string; url?: string; confirm?: boolean };
    let lumaLink = "";
    if (body.action === "link") {
      lumaLink = await validateLumaEventUrl(event, body.url?.trim() ?? "");
    } else if (body.action === "create") {
      if (body.confirm !== true) return NextResponse.json({ error: "Explicit confirmation is required." }, { status: 400 });
      if (event.lumaLink) return NextResponse.json({ error: "This Backstage event already has a Luma link." }, { status: 409 });
      lumaLink = (await createLumaEvent(event, body.calendarId)).url;
    } else {
      return NextResponse.json({ error: "Unknown Luma action." }, { status: 400 });
    }

    const updated = await source.updateEvent(event.id, { lumaLink });
    const luma = await getLiveLumaPreview(updated);
    return NextResponse.json({ event: updated, operations: getEventOperationsPreview(updated, luma) });
  } catch (error) {
    const status = error instanceof LumaApiError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Luma request failed." }, { status });
  }
}
