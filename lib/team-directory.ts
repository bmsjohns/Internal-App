import { clerkEnabled } from "@/lib/auth-config-runtime";
import { LOCATIONS, type Location } from "@/lib/types";
import { DEFAULT_ROLES, ROLE_IDS, type PermissionOverride, type RoleId } from "@/lib/permissions";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: RoleId;
  locations: Location[];
  overrides: PermissionOverride[];
  active: boolean;
  lastActiveAt: string | null;
}

interface AccessMetadata {
  roleId?: RoleId;
  role?: string;
  locations?: Location[];
  managerLocations?: Location[] | "all";
  permissionOverrides?: PermissionOverride[];
  permissions?: string[];
}

const validLocations = (value: unknown): Location[] => Array.isArray(value)
  ? value.filter((location): location is Location => LOCATIONS.includes(location as Location))
  : [];

export function accessFromMetadata(meta: AccessMetadata): Pick<TeamMember, "role" | "locations" | "overrides"> {
  let role: RoleId = ROLE_IDS.includes(meta.roleId as RoleId) ? meta.roleId! : meta.role === "manager" ? "manager" : "bar-floor-staff";
  const bootstrapLegacyManager = meta.role === "manager" && !meta.roleId;
  if (bootstrapLegacyManager) role = "manager";
  const locations = validLocations(meta.locations);
  const legacyLocations = meta.managerLocations === "all" ? [...LOCATIONS] : validLocations(meta.managerLocations);
  return {
    role,
    locations: role === "admin" ? [...LOCATIONS] : (locations.length ? locations : legacyLocations.length ? legacyLocations : [...LOCATIONS]),
    overrides: Array.isArray(meta.permissionOverrides) ? meta.permissionOverrides : [],
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __backstageMockTeam: TeamMember[] | undefined;
}

function seedTeam(): TeamMember[] {
  globalThis.__backstageMockTeam ??= [
    { id: "dev-user", name: process.env.DEV_AUTH_NAME ?? "Development Admin", email: process.env.DEV_AUTH_EMAIL ?? "admin@example.test", role: "admin", locations: [...LOCATIONS], overrides: [], active: true, lastActiveAt: new Date().toISOString() },
    { id: "events-demo", name: "Events Demo", email: "events@example.test", role: "events-lead", locations: ["Prologue"], overrides: [], active: true, lastActiveAt: "2026-07-18T16:42:00.000Z" },
    { id: "manager-demo", name: "Manager Demo", email: "manager@example.test", role: "manager", locations: ["Simply Books"], overrides: [{ permission: "ordering.send", location: "Simply Books", effect: "revoke" }], active: true, lastActiveAt: "2026-07-19T07:51:00.000Z" },
    { id: "staff-demo", name: "Staff Demo", email: "staff@example.test", role: "bar-floor-staff", locations: ["Prologue"], overrides: [], active: true, lastActiveAt: "2026-07-17T21:05:00.000Z" },
    { id: "clubs-demo", name: "Clubs Demo", email: "clubs@example.test", role: "book-club-manager", locations: ["Simply Books"], overrides: [{ permission: "ordering.send", location: "Simply Books", effect: "grant" }], active: true, lastActiveAt: "2026-07-18T12:10:00.000Z" },
  ];
  return globalThis.__backstageMockTeam;
}

function displayName(user: any): string {
  return user.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : (user.username ?? user.emailAddresses?.[0]?.emailAddress ?? "Unknown");
}

function toTeamMember(user: any): TeamMember {
  const access = accessFromMetadata((user.publicMetadata ?? {}) as AccessMetadata);
  return {
    id: user.id,
    name: displayName(user),
    email: user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? "",
    ...access,
    active: !user.banned && !user.locked,
    lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt).toISOString() : null,
  };
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  if (!clerkEnabled) return seedTeam().map((member) => ({ ...member, locations: [...member.locations], overrides: [...member.overrides] }));
  const { clerkClient } = await import("@clerk/nextjs/server");
  const client = await clerkClient();
  const { data } = await client.users.getUserList({ limit: 200, orderBy: "+first_name" });
  return data.map(toTeamMember);
}

export async function updateTeamMember(id: string, patch: Pick<TeamMember, "role" | "locations" | "overrides">): Promise<TeamMember> {
  const safePatch = patch.role === "admin" ? { ...patch, locations: [...LOCATIONS], overrides: [] } : patch;
  if (!clerkEnabled) {
    const members = seedTeam();
    const index = members.findIndex((member) => member.id === id);
    if (index < 0) throw new Error("Team member not found");
    members[index] = { ...members[index], ...safePatch };
    return { ...members[index] };
  }
  const { clerkClient } = await import("@clerk/nextjs/server");
  const client = await clerkClient();
  const current = await client.users.getUser(id);
  await client.users.updateUserMetadata(id, {
    publicMetadata: {
      ...current.publicMetadata,
      roleId: safePatch.role,
      locations: safePatch.locations,
      permissionOverrides: safePatch.overrides,
    },
  });
  return toTeamMember(await client.users.getUser(id));
}

export async function inviteTeamMember(email: string, role: RoleId, locations: Location[]): Promise<void> {
  if (!clerkEnabled) {
    const name = email.split("@")[0].split(/[._-]/).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
    seedTeam().push({ id: `mock-${Date.now()}`, name, email, role, locations, overrides: [], active: true, lastActiveAt: null });
    return;
  }
  const { clerkClient } = await import("@clerk/nextjs/server");
  const client = await clerkClient();
  await client.invitations.createInvitation({
    emailAddress: email,
    publicMetadata: { roleId: role, locations: role === "admin" ? [...LOCATIONS] : locations, permissionOverrides: [] },
    ignoreExisting: false,
  });
}

export async function setTeamMemberActive(id: string, active: boolean): Promise<void> {
  if (!clerkEnabled) {
    const member = seedTeam().find((candidate) => candidate.id === id);
    if (!member) throw new Error("Team member not found");
    member.active = active;
    return;
  }
  const { clerkClient } = await import("@clerk/nextjs/server");
  const client = await clerkClient();
  if (active) await client.users.unbanUser(id);
  else await client.users.banUser(id);
}

export function roleLabel(role: RoleId): string {
  return DEFAULT_ROLES.find((candidate) => candidate.id === role)?.name ?? role;
}
