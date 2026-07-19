/** Machine-to-machine callbacks authenticate with signatures, not Clerk. */
export const PUBLIC_ROUTES = [
  "/sign-in(.*)",
  "/manifest.webmanifest",
  "/icon.svg",
  "/api/stripe/webhook",
  "/api/luma/webhook",
] as const;
