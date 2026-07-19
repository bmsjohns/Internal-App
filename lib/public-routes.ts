/** Machine-to-machine callbacks authenticate with signatures, not Clerk. */
export const PUBLIC_ROUTES = [
  "/sign-in(.*)",
  "/manifest.webmanifest",
  "/icon.svg",
  "/api/stripe/webhook",
  "/api/luma/webhook",
  // Cron-triggered sales sync — authenticates itself via CRON_SECRET
  // bearer inside the route (and rejects everything else without a
  // logged-in admin), so Clerk must not 404 it first.
  "/api/dashboard/sync",
] as const;
