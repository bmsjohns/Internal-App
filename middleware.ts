import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublic = createRouteMatcher(["/sign-in(.*)", "/manifest.webmanifest", "/icon.svg"]);

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// With Clerk configured, every non-public route requires a session. Without
// it (local dev with DEV_AUTH_BYPASS=1), requests pass through and lib/auth
// supplies the dev user; API routes still 401 if neither is configured.
export default clerkEnabled
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublic(req)) await auth.protect();
    })
  : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
