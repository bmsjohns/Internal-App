import type { Location, SessionUser } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";

export const ROLE_IDS = ["admin", "manager", "events-lead", "bar-floor-staff", "book-club-manager"] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const PERMISSION_CATALOG = [
  { key: "orders.view", module: "Customer Orders", label: "View orders", description: "See orders and order details." },
  { key: "orders.manage", module: "Customer Orders", label: "Create & edit orders", description: "Create orders, update details and change statuses." },
  { key: "orders.delete", module: "Customer Orders", label: "Delete orders", description: "Delete an order at the permitted location.", sensitive: true },
  { key: "customers.view", module: "Customer Orders", label: "View customers", description: "See customer contact details and order history." },
  { key: "customers.manage", module: "Customer Orders", label: "Manage customers", description: "Create and edit customer records." },
  { key: "events.pitching.view", module: "Events · Pitching", label: "View pitching", description: "See the restricted pitching pipeline." },
  { key: "events.pitching.manage", module: "Events · Pitching", label: "Manage pitches", description: "Create, edit and move pitches." },
  { key: "events.pitching.delete", module: "Events · Pitching", label: "Delete pitches", description: "Permanently delete pitches.", sensitive: true },
  { key: "events.view", module: "Events", label: "View events", description: "See events, venues and hosts." },
  { key: "events.manage", module: "Events", label: "Manage events", description: "Create and edit events, venues and hosts." },
  { key: "events.staffing.manage", module: "Events", label: "Manage staffing", description: "Assign people, roles and running orders." },
  { key: "events.callsheet.view", module: "Events", label: "View assigned call sheets", description: "Open call sheets for events the person is staffed on." },
  { key: "ordering.view", module: "Ordering Hub", label: "View hub", description: "See staged, pending and outstanding orders." },
  { key: "ordering.manage", module: "Ordering Hub", label: "Stage & receive", description: "Stage, edit, mark arrived and manage restock lines." },
  { key: "ordering.send", module: "Ordering Hub", label: "Send orders", description: "Push an order by email or CSV.", sensitive: true },
  { key: "returns.view", module: "Returns", label: "View returns", description: "See the returns queue, pick lists and outstanding view." },
  { key: "returns.manage", module: "Returns", label: "Process returns", description: "Create requests, choose routes, record RAs, pick, ship and confirm credits." },
  { key: "clubs.view", module: "Book Clubs", label: "View clubs & members", description: "See clubs, members and payment standing." },
  { key: "clubs.manage", module: "Book Clubs", label: "Manage clubs", description: "Edit clubs, members and monthly selections." },
  { key: "clubs.stripe", module: "Book Clubs", label: "Stripe actions", description: "Pause, resume, move or cancel subscriptions.", sensitive: true },
  { key: "briefing.view", module: "Daily Briefing", label: "View briefing", description: "See the daily operational briefing." },
  { key: "briefing.alerts.manage", module: "Daily Briefing", label: "Manage alerts", description: "Post and clear operational alerts." },
  { key: "dashboard.view", module: "Management Dashboard", label: "View dashboard", description: "See the leadership dashboard — sales, live operations and trends." },
  { key: "settings.suppliers.manage", module: "Settings", label: "Manage suppliers", description: "Edit suppliers, accounts and ordering cadence." },
  { key: "team.manage", module: "Administration", label: "Manage team", description: "Invite, edit and deactivate users.", sensitive: true },
  { key: "roles.manage", module: "Administration", label: "Manage roles", description: "Change the default permission bundles.", sensitive: true },
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]["key"];
export type OverrideEffect = "grant" | "revoke";

export interface PermissionOverride {
  permission: PermissionKey;
  location: Location;
  effect: OverrideEffect;
}

export interface RoleDefinition {
  id: RoleId;
  name: string;
  description: string;
  permissions: PermissionKey[];
  locked?: boolean;
}

const ALL = PERMISSION_CATALOG.map((p) => p.key);

export const DEFAULT_ROLES: RoleDefinition[] = [
  { id: "admin", name: "Admin", description: "Full access at both locations, including people and role management.", permissions: [...ALL], locked: true },
  {
    id: "manager",
    name: "Manager",
    description: "Full operational access at their assigned location(s), except the restricted pitching pipeline.",
    permissions: ALL.filter((p) => p !== "team.manage" && p !== "roles.manage" && !p.startsWith("events.pitching.")),
  },
  {
    id: "events-lead",
    name: "Events Lead",
    description: "Pitching, event planning, staffing and call sheets, plus returns (they verify post-event returns).",
    permissions: [...ALL.filter((p) => p.startsWith("events.")), "returns.view", "returns.manage"],
  },
  { id: "bar-floor-staff", name: "Bar / Floor Staff", description: "Daily briefing and assigned call sheets.", permissions: ["briefing.view", "events.callsheet.view"] },
  { id: "book-club-manager", name: "Book Club Manager", description: "Book Clubs, Stripe actions and related Ordering Hub work.", permissions: ["clubs.view", "clubs.manage", "clubs.stripe", "ordering.view", "ordering.manage"] },
];

export const LEGACY_PERMISSION_MAP: Record<string, PermissionKey> = {
  "settings:manage": "settings.suppliers.manage",
  "callsheet:view": "events.callsheet.view",
  "pitching:view": "events.pitching.view",
  "pitching:edit": "events.pitching.manage",
  "pitching:delete": "events.pitching.delete",
  "events:view": "events.view",
  "events:edit": "events.manage",
  "hub:view": "ordering.view",
  "hub:send": "ordering.send",
  "returns:view": "returns.view",
  "clubs:view": "clubs.view",
  "clubs:manage": "clubs.manage",
};

export function permissionKey(value: string): PermissionKey | null {
  const mapped = LEGACY_PERMISSION_MAP[value] ?? value;
  return PERMISSION_CATALOG.some((p) => p.key === mapped) ? (mapped as PermissionKey) : null;
}

export function roleById(roles: RoleDefinition[], id: RoleId): RoleDefinition {
  return roles.find((role) => role.id === id) ?? DEFAULT_ROLES.find((role) => role.id === id)!;
}

export function hasPermission(
  user: Pick<SessionUser, "role" | "locations" | "permissionOverrides" | "rolePermissions">,
  permission: string,
  location?: Location
): boolean {
  const key = permissionKey(permission);
  if (!key) return false;
  const locations = location ? [location] : LOCATIONS;
  return locations.some((loc) => {
    if (!user.locations.includes(loc)) return false;
    const override = user.permissionOverrides.find((o) => o.permission === key && o.location === loc);
    if (override) return override.effect === "grant";
    return user.rolePermissions.includes(key);
  });
}

export function effectivePermissionCount(
  role: RoleDefinition,
  locations: Location[],
  overrides: PermissionOverride[]
): number {
  return LOCATIONS.reduce((count, location) => count + PERMISSION_CATALOG.filter((p) => {
    if (!locations.includes(location)) return false;
    const override = overrides.find((o) => o.permission === p.key && o.location === location);
    return override ? override.effect === "grant" : role.permissions.includes(p.key);
  }).length, 0);
}

export function groupedPermissions() {
  const groups = new Map<string, (typeof PERMISSION_CATALOG)[number][]>();
  for (const permission of PERMISSION_CATALOG) {
    groups.set(permission.module, [...(groups.get(permission.module) ?? []), permission]);
  }
  return [...groups.entries()].map(([module, permissions]) => ({ module, permissions }));
}
