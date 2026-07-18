import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getHubDataSource } from "@/lib/data/hub";

// Publishers reference data (C6): rates + account numbers + rep contact are
// staff-maintainable, never hardcoded — but edits are deliberate, so they
// share the settings:manage gate rather than plain hub access.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "settings:manage")) {
    return NextResponse.json({ error: "Editing publisher reference data needs settings:manage" }, { status: 403 });
  }
  const body = await req.json();
  const hub = getHubDataSource();
  try {
    if (body?.id) {
      const { id, ...input } = body;
      return NextResponse.json({ publisher: await hub.updatePublisher(id, input) });
    }
    if (!body?.name?.trim()) return NextResponse.json({ error: "Publisher name is required" }, { status: 400 });
    return NextResponse.json({ publisher: await hub.createPublisher(body) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Save failed" }, { status: 400 });
  }
}
