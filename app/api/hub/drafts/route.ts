import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getHubDataSource } from "@/lib/data/hub";
import { LOCATIONS } from "@/lib/types";

// Staging (Flow A) actions — general staff with hub access (C7): inline
// quantity/line edits, account assignment, logged delete, push to hub.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "hub:view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const hub = getHubDataSource();
  try {
    switch (body?.action) {
      case "updateLine": {
        if (!body.lineId) return NextResponse.json({ error: "lineId is required" }, { status: 400 });
        const patch: Record<string, unknown> = {};
        if (body.quantity != null) patch.quantity = Number(body.quantity);
        if (body.title !== undefined) patch.title = String(body.title);
        if (body.isbn !== undefined) patch.isbn = String(body.isbn);
        if (body.publisherId !== undefined) patch.publisherId = body.publisherId || null;
        if (body.imprint !== undefined) patch.imprint = String(body.imprint);
        if (body.rrp !== undefined) patch.rrp = body.rrp == null ? null : Number(body.rrp);
        return NextResponse.json({ line: await hub.updateDraftLine(body.lineId, patch) });
      }
      case "setAccount": {
        if (!body.draftKey || !LOCATIONS.includes(body.account)) {
          return NextResponse.json({ error: "draftKey and a valid account are required" }, { status: 400 });
        }
        await hub.setDraftAccount(body.draftKey, body.account, user.name);
        return NextResponse.json({ ok: true });
      }
      case "delete": {
        if (!body.draftKey) return NextResponse.json({ error: "draftKey is required" }, { status: 400 });
        const removed = await hub.deleteDraft(body.draftKey, user.name);
        // Deleting a draft never touches the originating record (C2) — a
        // drafted book-club pick keeps its selection; no order was raised.
        return NextResponse.json({ removed: removed.length });
      }
      case "push": {
        if (!body.draftKey) return NextResponse.json({ error: "draftKey is required" }, { status: 400 });
        return NextResponse.json({ lines: await hub.pushDraft(body.draftKey, user.name) });
      }
      default:
        return NextResponse.json({ error: `Unknown action "${body?.action}"` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Action failed" }, { status: 400 });
  }
}
