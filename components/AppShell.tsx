"use client";

import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/types";
import Sidebar, { isBareRoute } from "./Sidebar";

// Wraps every page in the nav chrome. On mobile the top bar and bottom tab
// bar are fixed, so main clears them — except on bare routes (call sheet,
// printable views), which render chrome-free and full-bleed.
export default function AppShell({ user, children }: { user: SessionUser | null; children: React.ReactNode }) {
  const bare = isBareRoute(usePathname());
  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className={`min-w-0 flex-1 bg-cream ${bare ? "" : "pb-[74px] pt-[52px] lg:pb-0 lg:pt-0"}`}>{children}</main>
    </div>
  );
}
