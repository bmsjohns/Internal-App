import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getEventsDataSource } from "@/lib/data/events";
import { getEventOperationsPreview } from "@/lib/event-operations";

type Params = { params: Promise<{ id: string }> };

/**
 * Read-only preview seam for richer event operations and Luma data.
 * There are intentionally no POST/PATCH/DELETE handlers in this branch.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:view")) return NextResponse.json({ error: "No events access" }, { status: 403 });

  const event = await getEventsDataSource().getEvent((await params).id);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ operations: getEventOperationsPreview(event), source: "mock-luma" });
}
