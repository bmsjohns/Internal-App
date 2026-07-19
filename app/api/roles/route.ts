import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { getRoleDefinitions, recordPermissionAudit, saveRoleDefinition } from "@/lib/data/permissions-store";
import { PERMISSION_CATALOG, ROLE_IDS, type PermissionKey, type RoleId } from "@/lib/permissions";

export async function GET() {
  const actor = await getSessionUser();
  if (!actor || !isAdmin(actor)) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  return NextResponse.json({ roles: await getRoleDefinitions(), catalog: PERMISSION_CATALOG });
}

export async function PATCH(req: NextRequest) {
  const actor = await getSessionUser();
  if (!actor || !isAdmin(actor)) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const body = await req.json();
  const id = body.id as RoleId;
  const allowed = new Set(PERMISSION_CATALOG.map((permission) => permission.key));
  const permissions: PermissionKey[] = Array.isArray(body.permissions)
    ? ([...new Set(body.permissions.filter((permission: unknown): permission is PermissionKey => typeof permission === "string" && allowed.has(permission as PermissionKey)))] as PermissionKey[])
    : [];
  if (!ROLE_IDS.includes(id) || id === "admin") return NextResponse.json({ error: "That role cannot be edited" }, { status: 400 });
  const roles = await getRoleDefinitions();
  const current = roles.find((role) => role.id === id);
  if (!current) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  try {
    const role = await saveRoleDefinition({ ...current, permissions });
    await recordPermissionAudit(actor.name, `Updated role defaults (${permissions.length} permissions)`, role.name);
    return NextResponse.json({ role });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Role update failed" }, { status: 400 });
  }
}
