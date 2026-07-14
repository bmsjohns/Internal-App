import { clerkEnabled } from "@/lib/auth";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  if (!clerkEnabled) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-blush bg-white p-6">
        <h1 className="text-xl font-semibold text-rust">Auth not configured</h1>
        <p className="mt-2 text-sm text-ink/70">
          Clerk keys are not set. For local development, set{" "}
          <code className="rounded bg-shell px-1">DEV_AUTH_BYPASS=1</code> in{" "}
          <code className="rounded bg-shell px-1">.env.local</code>, or add your Clerk keys — see README.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-16 flex justify-center">
      <SignIn />
    </div>
  );
}
