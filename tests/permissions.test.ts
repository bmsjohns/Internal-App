import { describe, expect, it } from "vitest";
import { DEFAULT_ROLES, hasPermission, roleById, type PermissionOverride } from "@/lib/permissions";
import type { Location, SessionUser } from "@/lib/types";

function user(role: SessionUser["role"], locations: Location[], permissionOverrides: PermissionOverride[] = []): SessionUser {
  const definition = roleById(DEFAULT_ROLES, role);
  return {
    id: "test", name: "Test User", email: "test@example.com", role, locations,
    managerLocations: locations.length === 2 ? "all" : locations,
    rolePermissions: definition.permissions,
    permissionOverrides,
    permissions: [],
  };
}

describe("location-scoped permissions", () => {
  it("applies a role default only at assigned locations", () => {
    const manager = user("manager", ["Simply Books"]);
    expect(hasPermission(manager, "orders.manage", "Simply Books")).toBe(true);
    expect(hasPermission(manager, "orders.manage", "Prologue")).toBe(false);
  });

  it("can revoke a role default for one location", () => {
    const manager = user("manager", ["Simply Books", "Prologue"], [
      { permission: "ordering.send", location: "Prologue", effect: "revoke" },
    ]);
    expect(hasPermission(manager, "ordering.send", "Simply Books")).toBe(true);
    expect(hasPermission(manager, "ordering.send", "Prologue")).toBe(false);
  });

  it("can grant an extra permission without inventing a role", () => {
    const staff = user("bar-floor-staff", ["Prologue"], [
      { permission: "ordering.send", location: "Prologue", effect: "grant" },
    ]);
    expect(hasPermission(staff, "ordering.send", "Prologue")).toBe(true);
    expect(hasPermission(staff, "ordering.manage", "Prologue")).toBe(false);
  });

  it("preserves legacy permission names during module migration", () => {
    const lead = user("events-lead", ["Prologue"]);
    expect(hasPermission(lead, "pitching:view", "Prologue")).toBe(true);
    expect(hasPermission(lead, "events:edit", "Prologue")).toBe(true);
  });

  it("keeps Stripe actions separate from general club management", () => {
    const custom = user("bar-floor-staff", ["Simply Books"], [
      { permission: "clubs.manage", location: "Simply Books", effect: "grant" },
    ]);
    expect(hasPermission(custom, "clubs.manage", "Simply Books")).toBe(true);
    expect(hasPermission(custom, "clubs.stripe", "Simply Books")).toBe(false);
  });
});
