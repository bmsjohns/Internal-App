import type { Location, Role, SessionUser } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";

export const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Explicit local-dev escape hatch so the app can run without a Clerk account.
// Refuses to activate in production builds.
const devBypass = () =>
  process.env.DEV_AUTH_BYPASS === "1" && process.env.NODE_ENV !== "production";

// Default permission grants per role. Explicit `permissions` in Clerk
// publicMetadata override these, so e.g. settings:manage can later be given
// to a non-manager (or taken from a venue manager) without code changes.
const ROLE_PERMISSIONS: Record<Role, string[]> = {
  staff: [],
  manager: ["settings:manage"],
};

/**
 * Resolve the current user, from Clerk when configured.
 *
 * Roles, venue scoping and permissions live in Clerk `publicMetadata`, set
 * per-user in the Clerk dashboard (no redeploy needed):
 *   { "role": "manager", "managerLocations": ["Prologue"] }        — venue-scoped manager
 *   { "role": "manager", "managerLocations": "all" }               — joint manager
 *   { "role": "staff" }                                            — staff (default)
 *   { "role": "staff", "permissions": ["settings:manage"] }        — explicit grant
 *
 * NOTE: Clerk's built-in custom org roles/permissions are a paid add-on, so to
 * keep the target cost at zero we model roles in publicMetadata instead — still
 * centrally managed in the Clerk dashboard. See README §Auth.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (clerkEnabled) {
    const { currentUser } = await import("@clerk/nextjs/server");
    const u = await currentUser();
    if (!u) return null;
    const meta = (u.publicMetadata ?? {}) as {
      role?: Role;
      managerLocations?: Location[] | "all";
      permissions?: string[];
    };
    const role: Role = meta.role === "manager" ? "manager" : "staff";
    return {
      id: u.id,
      name: u.firstName ? `${u.firstName}${u.lastName ? " " + u.lastName : ""}` : (u.username ?? "Unknown"),
      role,
      managerLocations: role === "manager" ? (meta.managerLocations ?? "all") : [],
      permissions: meta.permissions ?? ROLE_PERMISSIONS[role],
    };
  }
  if (devBypass()) {
    const role = (process.env.DEV_AUTH_ROLE as Role) ?? "manager";
    return {
      id: "dev-user",
      name: process.env.DEV_AUTH_NAME ?? "Ben",
      role,
      managerLocations: role === "manager" ? "all" : [],
      permissions: ROLE_PERMISSIONS[role],
    };
  }
  return null;
}

/** Permission check (V3 §3): prefer this over raw role checks for features. */
export function can(user: SessionUser, permission: string): boolean {
  return user.permissions.includes(permission);
}

/** Can this user delete an order at the given venue? (spec §11a.4) */
export function canDeleteAt(user: SessionUser, location: Location): boolean {
  if (user.role !== "manager") return false;
  return user.managerLocations === "all" || user.managerLocations.includes(location);
}

export function managedLocations(user: SessionUser): Location[] {
  if (user.role !== "manager") return [];
  return user.managerLocations === "all" ? LOCATIONS : user.managerLocations;
}
