import { describe, expect, it } from "vitest";
import { PUBLIC_ROUTES } from "@/lib/public-routes";
import { DEFAULT_ROLES, hasPermission, roleById } from "@/lib/permissions";
import type { Location, SessionUser } from "@/lib/types";

function scopedUser(locations: Location[]): SessionUser {
  const role = roleById(DEFAULT_ROLES, "manager");
  return {
    id: "manager", name: "Manager", email: "manager@example.test", role: "manager",
    locations, managerLocations: locations.length === 2 ? "all" : locations,
    rolePermissions: role.permissions, permissionOverrides: [], permissions: [],
  };
}

describe("machine callback boundaries", () => {
  it("keeps both signed webhook endpoints outside Clerk session protection", () => {
    expect(PUBLIC_ROUTES).toContain("/api/stripe/webhook");
    expect(PUBLIC_ROUTES).toContain("/api/luma/webhook");
  });
});

describe("record location authorization matrix", () => {
  const simplyManager = scopedUser(["Simply Books"]);
  const permissions = ["returns.view", "returns.manage", "briefing.view", "briefing.alerts.manage", "clubs.view", "clubs.manage"];

  for (const permission of permissions) {
    it(`${permission} does not cross from Simply Books into Prologue`, () => {
      expect(hasPermission(simplyManager, permission, "Simply Books")).toBe(true);
      expect(hasPermission(simplyManager, permission, "Prologue")).toBe(false);
    });
  }
});
