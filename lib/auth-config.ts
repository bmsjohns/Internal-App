export type AuthMode = "clerk" | "development-bypass" | "unavailable";

export function authMode(env: {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  DEV_AUTH_BYPASS?: string;
  NODE_ENV?: string;
}): AuthMode {
  if (env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return "clerk";
  if (env.DEV_AUTH_BYPASS === "1" && env.NODE_ENV !== "production") return "development-bypass";
  return "unavailable";
}
