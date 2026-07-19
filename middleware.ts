import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { authMode } from "@/lib/auth-config";
import { PUBLIC_ROUTES } from "@/lib/public-routes";

// Stripe's webhook calls carry no Clerk session — it authenticates itself
// via HMAC signature (lib/stripe.ts verifyWebhookSignature), so it must be
// reachable without a login rather than 404ing behind auth.protect().
const isPublic = createRouteMatcher([...PUBLIC_ROUTES]);

const mode = authMode(process.env);

function missingAuthResponse(req: Request) {
  if (new URL(req.url).pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication is not configured" }, { status: 503 });
  }
  return new NextResponse("Authentication is not configured", {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}

// Missing production auth configuration must fail closed. The only pass-through
// path is the explicit development-only bypass mirrored in lib/auth.
export default mode === "clerk"
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublic(req)) await auth.protect();
    })
  : mode === "development-bypass"
    ? () => NextResponse.next()
    : (req: Request) => missingAuthResponse(req);

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
