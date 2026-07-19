import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getEventsDataSource } from "@/lib/data/events";
import { getEventOperationsPreview } from "@/lib/event-operations";
import { getLiveLumaPreview, isLumaLive, publicLumaCalendars } from "@/lib/luma";

type Params = { params: Promise<{ id: string }> };

/**
 * Event operations remain read-only here. When explicitly enabled, only the
 * Luma portion is hydrated from live aggregate data.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:view")) return NextResponse.json({ error: "No events access" }, { status: 403 });

  const event = await getEventsDataSource().getEvent((await params).id);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isLumaLive()) {
    const operations = getEventOperationsPreview(event);
    operations.luma.availableCalendars = publicLumaCalendars();
    return NextResponse.json({ operations, source: "mock-luma" });
  }
  try {
    const luma = await getLiveLumaPreview(event);
    return NextResponse.json({ operations: getEventOperationsPreview(event, luma), source: "live-luma" });
  } catch (error) {
    console.error("[luma] event sync fell back to safe preview", {
      eventId: event.id,
      error: error instanceof Error ? error.message : "Unknown Luma error",
    });
    const operations = getEventOperationsPreview(event);
    operations.luma.integration = "error";
    operations.luma.canCreate = true;
    operations.luma.syncError = error instanceof Error ? error.message : "Luma sync failed.";
    operations.luma.availableCalendars = publicLumaCalendars();
    return NextResponse.json({ operations, source: "luma-fallback" });
  }
}
