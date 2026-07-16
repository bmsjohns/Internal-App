import type { StaffRef } from "@/lib/types";
import { clerkEnabled } from "@/lib/auth";

/** Directory entry for the staffing pickers — StaffRef + a display role. */
export interface StaffMember extends StaffRef {
  staffRole: string;
}

// Mock directory for DATA_SOURCE=mock — names mirror the live Staffing
// multi-select options so the seeded events look like the real team.
const MOCK_STAFF: StaffMember[] = [
  { id: "ben", name: "Ben", staffRole: "Manager" },
  { id: "karen", name: "Karen", staffRole: "Manager" },
  { id: "lynsey", name: "Lynsey", staffRole: "Events lead" },
  { id: "charlotte", name: "Charlotte", staffRole: "Bookseller" },
  { id: "jess", name: "Jess", staffRole: "Bookseller" },
  { id: "matt", name: "Matt", staffRole: "Bookseller" },
  { id: "lucy", name: "Lucy", staffRole: "Bookseller" },
  { id: "chloe", name: "Chloe", staffRole: "Bar" },
  { id: "barbara", name: "Barbara", staffRole: "Bookseller" },
  { id: "liv", name: "Liv", staffRole: "Bar" },
];

/**
 * Who can be assigned to event roles. With Clerk configured this is the
 * Clerk user list — the same identity day-of staff sign in with, so "you"
 * highlighting on the call sheet just works (spec §6.1). Mock mode uses the
 * seeded team above.
 */
export async function getStaffDirectory(): Promise<StaffMember[]> {
  if (clerkEnabled) {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const { data } = await client.users.getUserList({ limit: 200 });
    return data
      .map((u) => ({
        id: u.id,
        name: u.firstName ? `${u.firstName}${u.lastName ? " " + u.lastName : ""}` : (u.username ?? "Unknown"),
        staffRole: ((u.publicMetadata as { role?: string })?.role ?? "staff") === "manager" ? "Manager" : "Staff",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return MOCK_STAFF;
}
