"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/types";

// Shared shell for all modules (spec §8): future modules (Events, Schools…)
// add a tab here and a folder under app/.
const MODULES = [
  { href: "/orders", label: "Orders" },
  { href: "/customers", label: "Customers" },
  { href: "/summary", label: "End of day" },
];

export default function Nav({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  return (
    <header className="border-b-2 border-rust bg-paper">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link href="/orders" className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold text-rust">Order Book<span className="text-coral">.</span></span>
        </Link>
        <nav className="flex gap-1">
          {MODULES.map((m) => {
            const active = pathname.startsWith(m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                  active ? "bg-rust text-paper" : "text-ink hover:bg-shell"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto text-sm text-ink/70">
          {user ? (
            <span>
              {user.name}
              {user.role === "manager" && (
                <span className="ml-1.5 rounded bg-blush px-1.5 py-0.5 text-xs font-semibold text-rust-dark">manager</span>
              )}
            </span>
          ) : (
            <Link href="/sign-in" className="text-rust underline">Sign in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
