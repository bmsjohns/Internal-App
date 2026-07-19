import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { recordPermissionAudit } from "@/lib/data/permissions-store";
import { listTeamMembers, setTeamMemberActive, updateTeamMember } from "@/lib/team-directory";
import { LOCATIONS, type Location } from "@/lib/types";
import { PERMISSION_CATALOG, ROLE_IDS, type PermissionOverride, type RoleId } from "@/lib/permissions";

const validOverrides = (value: unknown): PermissionOverride[] => {
  if (!Array.isArray(value)) return [];
  const permissionKeys = new Set(PERMISSION_CATALOG.map((permission) => permission.key));
  const seen = new Set<string>();
  return value.filter((override): override is PermissionOverride => {
    if (!override || typeof override !== "object") return false;
    const item = override as PermissionOverride;
    const identity = `${item.permission}:${item.location}`;
    if (seen.has(identity) || !permissionKeys.has(item.permission) || !LOCATIONS.includes(item.location) || !["grant", "revoke"].includes(item.effect)) return false;
    seen.add(identity);
    return true;
  });
};

async function adminActor() {
  const actor = await getSessionUser();
  return actor && isAdmin(actor) ? actor : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await adminActor();
  if (!actor) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;
  if (id === actor.id) return NextResponse.json({ error: "Admins cannot change their own access" }, { status: 409 });
  const body = await req.json();
  const role = body.role as RoleId;
  const locations = Array.isArray(body.locations)
    ? body.locations.filter((location: unknown): location is Location => LOCATIONS.includes(location as Location))
    : [];
  if (!ROLE_IDS.includes(role) || (role !== "admin" && !locations.length)) {
    return NextResponse.json({ error: "A valid role and at least one location are required" }, { status: 400 });
  }
  try {
    const member = await updateTeamMember(id, { role, locations, overrides: validOverrides(body.overrides) });
    await recordPermissionAudit(actor.name, `Changed access: ${role}; ${member.locations.join(", ")}; ${member.overrides.length} override(s)`, member.email);
    return NextResponse.json({ member });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await adminActor();
  if (!actor) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;
  if (id === actor.id) return NextResponse.json({ error: "You cannot deactivate yourself" }, { status: 409 });
  const members = await listTeamMembers();
  const target = members.find((member) => member.id === id);
  if (!target) return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  if (target.role === "admin" && target.active && members.filter((member) => member.role === "admin" && member.active).length <= 1) {
    return NextResponse.json({ error: "The last active Admin cannot be deactivated" }, { status: 409 });
  }
  await setTeamMemberActive(id, false);
  await recordPermissionAudit(actor.name, "Deactivated account", target.email);
  return NextResponse.json({ ok: true });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await adminActor();
  if (!actor) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;
  const members = await listTeamMembers();
  const target = members.find((member) => member.id === id);
  if (!target) return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  await setTeamMemberActive(id, true);
  await recordPermissionAudit(actor.name, "Reactivated account", target.email);
  return NextResponse.json({ ok: true });
}
