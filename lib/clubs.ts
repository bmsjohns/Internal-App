import type { ClubStatus, MembershipStatus, PayStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Book Clubs domain helpers — sibling of lib/config.ts / lib/events.ts.
// Visuals follow the Claude Design file "Book Clubs & Ordering Hub.dc.html".
// ---------------------------------------------------------------------------

/** Status pill colours (design: statusTag). */
export const CLUB_STATUS: Record<ClubStatus, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#2E6B4F", bg: "#E1EFE7" },
  paused: { label: "Paused", color: "#B0812F", bg: "#FBF1DA" },
  inactive: { label: "Inactive", color: "#8C857C", bg: "#EDEAE3" },
};

export const MEMBERSHIP_STATUS: Record<MembershipStatus, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "#2E6B4F", bg: "#E1EFE7" },
  paused: { label: "Paused", color: "#B0812F", bg: "#FBF1DA" },
  cancelled: { label: "Cancelled", color: "#8C857C", bg: "#EDEAE3" },
};

export const PAY_STATUS: Record<PayStatus, { label: string; color: string; bg: string }> = {
  ok: { label: "Paid", color: "#2E6B4F", bg: "transparent" },
  failed: { label: "Failed", color: "#8B2D1E", bg: "#FBEAE7" },
  past_due: { label: "Past due", color: "#8B2D1E", bg: "#FBEAE7" },
};

/** Current selection month, Europe/London — "YYYY-MM". */
export function currentMonthKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}`;
}

/** "2026-08" → "August 2026". */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Previous n month keys (for selection history), newest first. */
export function recentMonthKeys(n: number, from = currentMonthKey()): string[] {
  const [y, m] = from.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export const money = (n: number) => `£${n.toFixed(2)}`;

// ---------------------------------------------------------------------------
// Session cadence — clubs meet monthly on the Nth instance of a weekday
// (live base: Week "Week 1".."Week 4" + Day + Time, joined by the
// "Session Time" formula as "Week 2 - Wednesday - 8pm").
// ---------------------------------------------------------------------------

const ORDINALS = ["", "1st", "2nd", "3rd", "4th"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Week 2 - Wednesday - 8pm" → "2nd Wednesday · 8pm". Blank parts drop out. */
export function prettyCadence(sessionTime: string): string {
  const [week, day, time] = String(sessionTime ?? "").split(" - ").map((s) => s.trim());
  const n = /^Week ([1-4])$/.exec(week ?? "")?.[1];
  const parts = [[n ? ORDINALS[Number(n)] : "", day].filter(Boolean).join(" "), time].filter(Boolean);
  return parts.join(" · ");
}

/**
 * The club's session date in a given month: the Nth instance of its weekday
 * ("Date Required For" on a monthly pick). null when the pattern is unknown.
 */
export function nthWeekdayDate(monthKey: string, week: string, day: string): string | null {
  const [y, m] = monthKey.split("-").map(Number);
  const n = Number(/([1-4])/.exec(week ?? "")?.[1]);
  const wd = WEEKDAYS.findIndex((w) => w.toLowerCase() === String(day ?? "").trim().toLowerCase());
  if (!y || !m || !n || wd < 0) return null;
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (wd - first.getUTCDay() + 7) % 7;
  const date = 1 + offset + (n - 1) * 7;
  if (date > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null; // 4th instance overflowed
  return `${y}-${String(m).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

/** Deterministic warm avatar colour per name (design: avatarColor). */
export function avatarColor(name: string, teal = false): string {
  let s = 0;
  for (const ch of name) s = (s + ch.charCodeAt(0)) % 360;
  const hue = (teal ? 158 : 12) + (s % 40);
  return `hsl(${hue} ${teal ? 38 : 52}% ${42 + (s % 14)}%)`;
}
