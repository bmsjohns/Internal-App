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
  staff: ["callsheet:view", "hub:view"],
  manager: ["settings:manage", "callsheet:view", "hub:view", "hub:send"],
};

// Events Phase 1: pitching is deliberately NOT granted by any role — access
// is restricted to a small group Ben names, via explicit `permissions` in
// Clerk publicMetadata (same add/remove-in-dashboard mechanism as the rest
// of the app). NOTE the override semantics above: listing `permissions` for
// a manager replaces their defaults, so include "settings:manage" too, e.g.
//   { "role": "manager", "permissions": ["settings:manage", "pitching:view",
//     "pitching:edit", "pitching:delete"] }
export const PITCHING_PERMISSIONS = ["pitching:view", "pitching:edit", "pitching:delete"];

// Events Phase 2: three access tiers (spec §1/§6.2).
//  - events:view / events:edit — the Events module proper (list, detail,
//    venues, hosts). Granted explicitly like pitching for now; likely a
//    broader group than pitching since running a live event involves more
//    people day-to-day. CONFIRM WITH BEN whether this should instead default
//    on for all staff (README §Events).
//  - callsheet:view — the day-of tier: ONLY the standalone call sheet page
//    for events you're staffed on. Deliberately its own, narrower permission
//    (not a subset check on events:view) and granted to every role by
//    default, so the whole on-the-day team can open their call sheet without
//    being let into the rest of the module.
export const EVENTS_PERMISSIONS = ["events:view", "events:edit"];
export const CALLSHEET_PERMISSION = "callsheet:view";

// Book Clubs + Ordering Hub (combined spec, Jul 2026):
//  - hub:view — the Ordering Hub: staging + inline edits, the pending queue,
//    marking arrived, restock capture. Spec C7 wants all of that friction-free
//    for general staff, so BOTH roles get it by default.
//  - hub:send — actually sending a batch (email or CSV). Restricted (C7);
//    manager default, grantable per-person. The UI shows send controls as
//    permission-locked rather than hiding them, so staff understand.
//  - clubs:view / clubs:manage — member CRM incl. payment standing, and the
//    Stripe write actions + monthly picks respectively. NOT granted by any
//    role default for now: the spec's open question (Part D) is whether
//    payment-adjacent member data should be visible to the same broad group
//    as Orders — until Ben decides, access is explicit-grant like pitching.
export const HUB_PERMISSIONS = ["hub:view", "hub:send"];
export const CLUBS_PERMISSIONS = ["clubs:view", "clubs:manage"];

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
      // Dev user gets pitching + events + clubs access so every module is
      // reachable locally (hub:view/hub:send already come from the role).
      permissions: [...ROLE_PERMISSIONS[role], ...PITCHING_PERMISSIONS, ...EVENTS_PERMISSIONS, ...CLUBS_PERMISSIONS],
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
