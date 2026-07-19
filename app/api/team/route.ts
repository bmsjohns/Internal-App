import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { getRoleDefinitions, recordPermissionAudit } from "@/lib/data/permissions-store";
import { inviteTeamMember, listTeamMembers } from "@/lib/team-directory";
import { LOCATIONS, type Location } from "@/lib/types";
import { ROLE_IDS, type RoleId } from "@/lib/permissions";

export async function GET() {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(actor)) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const [members, roles] = await Promise.all([listTeamMembers(), getRoleDefinitions()]);
  return NextResponse.json({ members, roles, currentUserId: actor.id });
}

export async function POST(req: NextRequest) {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(actor)) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const body = await req.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role as RoleId;
  const locations = Array.isArray(body.locations)
    ? body.locations.filter((location: unknown): location is Location => LOCATIONS.includes(location as Location))
    : [];
  if (!/^\S+@\S+\.\S+$/.test(email) || !ROLE_IDS.includes(role) || (role !== "admin" && !locations.length)) {
    return NextResponse.json({ error: "A valid email, role and at least one location are required" }, { status: 400 });
  }
  try {
    await inviteTeamMember(email, role, locations);
    await recordPermissionAudit(actor.name, `Invited as ${role}`, email);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invite failed" }, { status: 400 });
  }
}
