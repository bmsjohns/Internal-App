import type { Location, SessionUser } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";
import { clerkEnabled } from "@/lib/auth-config-runtime";
import { getRoleDefinitions } from "@/lib/data/permissions-store";
import {
  LEGACY_PERMISSION_MAP,
  hasPermission,
  permissionKey,
  roleById,
  type PermissionOverride,
  type RoleId,
} from "@/lib/permissions";
import { accessFromMetadata } from "@/lib/team-directory";

export { clerkEnabled };

const devBypass = () => process.env.DEV_AUTH_BYPASS === "1" && process.env.NODE_ENV !== "production";

export const PITCHING_PERMISSIONS = ["pitching:view", "pitching:edit", "pitching:delete"];
export const EVENTS_PERMISSIONS = ["events:view", "events:edit"];
export const CALLSHEET_PERMISSION = "callsheet:view";
export const HUB_PERMISSIONS = ["hub:view", "hub:send"];
export const CLUBS_PERMISSIONS = ["clubs:view", "clubs:manage"];
// Returns (Ben, 19 Jul 2026): its own module permissions — catalog keys
// returns.view / returns.manage in lib/permissions.ts; "returns:view" is
// the legacy alias.
export const RETURNS_PERMISSIONS = ["returns:view"];

function bootstrapAdmin(email: string): boolean {
  const configured = (process.env.PERMISSIONS_BOOTSTRAP_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configured.includes(email.toLowerCase());
}

function compatibilityPermissions(rolePermissions: string[], overrides: PermissionOverride[], locations: Location[]): string[] {
  const effective = new Set<string>();
  for (const permission of rolePermissions) {
    if (locations.some((location) => !overrides.some((o) => o.permission === permission && o.location === location && o.effect === "revoke"))) {
      effective.add(permission);
    }
  }
  for (const override of overrides) if (override.effect === "grant" && locations.includes(override.location)) effective.add(override.permission);
  for (const [legacy, modern] of Object.entries(LEGACY_PERMISSION_MAP)) if (effective.has(modern)) effective.add(legacy);
  return [...effective];
}

async function buildSession(input: {
  id: string;
  name: string;
  email: string;
  role: RoleId;
  locations: Location[];
  overrides: PermissionOverride[];
}): Promise<SessionUser> {
  const roles = await getRoleDefinitions();
  const role = roleById(roles, input.role);
  const locations = input.role === "admin" ? [...LOCATIONS] : input.locations;
  return {
    id: input.id,
    name: input.name,
    email: input.email,
    role: input.role,
    locations,
    managerLocations: locations.length === LOCATIONS.length ? "all" : locations,
    rolePermissions: role.permissions,
    permissionOverrides: input.overrides,
    permissions: compatibilityPermissions(role.permissions, input.overrides, locations),
  };
}

/** Resolve the current identity and its effective role inputs on every request.
 * Clerk metadata updates therefore take effect after router.refresh(), without
 * ending the person's session. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (clerkEnabled) {
    const { currentUser } = await import("@clerk/nextjs/server");
    const user = await currentUser();
    if (!user) return null;
    const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "";
    const access = accessFromMetadata((user.publicMetadata ?? {}) as any);
    const role: RoleId = bootstrapAdmin(email) ? "admin" : access.role;
    return buildSession({
      id: user.id,
      name: user.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : (user.username ?? "Unknown"),
      email,
      role,
      locations: role === "admin" ? [...LOCATIONS] : access.locations,
      overrides: access.overrides,
    });
  }
  if (devBypass()) {
    const requested = process.env.DEV_AUTH_ROLE as RoleId | undefined;
    const role: RoleId = requested && ["admin", "manager", "events-lead", "bar-floor-staff", "book-club-manager"].includes(requested)
      ? requested
      : "admin";
    return buildSession({
      id: "dev-user",
      name: process.env.DEV_AUTH_NAME ?? "Development Admin",
      email: process.env.DEV_AUTH_EMAIL ?? "admin@example.test",
      role,
      locations: [...LOCATIONS],
      overrides: [],
    });
  }
  return null;
}

/** Location-aware permission check. Omitting location asks whether the user
 * can perform the action at at least one location (useful for navigation). */
export function can(user: SessionUser, permission: string, location?: Location): boolean {
  return hasPermission(user, permission, location);
}

export function canDeleteAt(user: SessionUser, location: Location): boolean {
  return can(user, "orders.delete", location);
}

export function managedLocations(user: SessionUser): Location[] {
  return LOCATIONS.filter((location) => can(user, "orders.manage", location));
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === "admin" && can(user, "team.manage") && can(user, "roles.manage");
}

export function normalisePermission(value: string) {
  return permissionKey(value);
}
