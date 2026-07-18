import { describe, expect, it } from "vitest";
import { authMode } from "@/lib/auth-config";

describe("authMode", () => {
  it("uses Clerk whenever a publishable key is configured", () => {
    expect(authMode({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_123", DEV_AUTH_BYPASS: "1", NODE_ENV: "production" })).toBe("clerk");
  });

  it("allows the explicit bypass outside production", () => {
    expect(authMode({ DEV_AUTH_BYPASS: "1", NODE_ENV: "development" })).toBe("development-bypass");
  });

  it("fails closed in production even when the bypass variable is present", () => {
    expect(authMode({ DEV_AUTH_BYPASS: "1", NODE_ENV: "production" })).toBe("unavailable");
  });

  it("fails closed when authentication is unconfigured", () => {
    expect(authMode({ NODE_ENV: "production" })).toBe("unavailable");
  });
});
