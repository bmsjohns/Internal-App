import { atBase, atBaseList, requireBackstageBase } from "@/lib/data/backstage-base";
import { DEFAULT_ROLES, ROLE_IDS, type PermissionKey, type RoleDefinition, type RoleId } from "@/lib/permissions";

const TABLE = "Permission Roles";

declare global {
  // eslint-disable-next-line no-var
  var __backstageMockRoles: RoleDefinition[] | undefined;
}

function copyDefaults(): RoleDefinition[] {
  return DEFAULT_ROLES.map((role) => ({ ...role, permissions: [...role.permissions] }));
}

function mockRoles(): RoleDefinition[] {
  globalThis.__backstageMockRoles ??= copyDefaults();
  return globalThis.__backstageMockRoles;
}

function validRole(record: any): RoleDefinition | null {
  const id = String(record.fields?.Slug ?? "") as RoleId;
  if (!ROLE_IDS.includes(id)) return null;
  let permissions: PermissionKey[] = [];
  try {
    const parsed = JSON.parse(String(record.fields?.Permissions ?? "[]"));
    if (Array.isArray(parsed)) permissions = parsed.filter((p): p is PermissionKey => typeof p === "string");
  } catch { /* fall back below */ }
  const fallback = DEFAULT_ROLES.find((role) => role.id === id)!;
  return {
    id,
    name: String(record.fields?.Name ?? fallback.name),
    description: String(record.fields?.Description ?? fallback.description),
    permissions: permissions.length ? permissions : [...fallback.permissions],
    locked: id === "admin",
  };
}

export async function getRoleDefinitions(): Promise<RoleDefinition[]> {
  if (process.env.DATA_SOURCE !== "airtable") return mockRoles();
  try {
    const base = await requireBackstageBase("Team permissions");
    const records = await atBaseList(base, TABLE);
    const stored = records.map(validRole).filter((role): role is RoleDefinition => !!role);
    return DEFAULT_ROLES.map((fallback) => stored.find((role) => role.id === fallback.id) ?? { ...fallback, permissions: [...fallback.permissions] });
  } catch (error) {
    console.warn("Permission Roles table unavailable; using safe starter roles", error);
    return copyDefaults();
  }
}

export async function saveRoleDefinition(input: RoleDefinition): Promise<RoleDefinition> {
  if (input.id === "admin") throw new Error("The Admin role is locked to full access.");
  const cleaned: RoleDefinition = {
    ...input,
    permissions: [...new Set(input.permissions)],
    locked: false,
  };
  if (process.env.DATA_SOURCE !== "airtable") {
    const roles = mockRoles();
    const index = roles.findIndex((role) => role.id === cleaned.id);
    if (index < 0) throw new Error("Unknown role");
    roles[index] = cleaned;
    return cleaned;
  }
  const base = await requireBackstageBase("Team permissions");
  const records = await atBaseList(base, TABLE, { filterByFormula: `{Slug}="${cleaned.id}"`, maxRecords: "1" });
  const fields = {
    Name: cleaned.name,
    Slug: cleaned.id,
    Description: cleaned.description,
    Permissions: JSON.stringify(cleaned.permissions),
    Locked: false,
  };
  if (records[0]) {
    await atBase(base, `${encodeURIComponent(TABLE)}/${records[0].id}`, { method: "PATCH", body: JSON.stringify({ fields }) });
  } else {
    await atBase(base, encodeURIComponent(TABLE), { method: "POST", body: JSON.stringify({ fields }) });
  }
  return cleaned;
}

export async function recordPermissionAudit(actor: string, action: string, target = ""): Promise<void> {
  if (process.env.DATA_SOURCE !== "airtable") return;
  try {
    const base = await requireBackstageBase("Permission audit");
    await atBase(base, encodeURIComponent("Permission Audit"), {
      method: "POST",
      body: JSON.stringify({ fields: { At: new Date().toISOString(), Actor: actor, Action: action, Target: target } }),
    });
  } catch (error) {
    // Access changes must not be rolled back because the auxiliary audit table
    // has not been migrated yet. Clerk still records the metadata mutation.
    console.warn("Permission audit write failed", error);
  }
}
