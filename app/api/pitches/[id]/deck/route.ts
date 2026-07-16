import { NextRequest, NextResponse } from "next/server";
import { getEventsDataSource } from "@/lib/data/events";
import { can, getSessionUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// Airtable's direct-upload endpoint caps files at 5MB per request.
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "pitching:edit")) {
    return NextResponse.json({ error: "No pitching edit access" }, { status: 403 });
  }
  const { id } = await params;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (5MB max)" }, { status: 400 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const pitch = await getEventsDataSource().uploadPitchDeck(id, {
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    base64,
  });
  return NextResponse.json({ pitch });
}
