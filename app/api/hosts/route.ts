import { NextRequest, NextResponse } from "next/server";
import { getEventsDataSource } from "@/lib/data/events";
import { can, getSessionUser, isAdmin } from "@/lib/auth";
import { parseHostBody } from "@/lib/events-api";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "events:view")) {
    return NextResponse.json({ error: "No events access" }, { status: 403 });
  }
  const hosts = await getEventsDataSource().listHosts();
  return NextResponse.json({ hosts, canEdit: isAdmin(user) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "No events edit access" }, { status: 403 });
  }
  const input = parseHostBody(await req.json());
  if (!input.name) return NextResponse.json({ error: "Host name is required" }, { status: 400 });
  const host = await getEventsDataSource().createHost(input);
  return NextResponse.json({ host }, { status: 201 });
}
