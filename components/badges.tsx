import type { Location } from "@/lib/types";
import { NEEDS_ORDERING_STATUSES } from "@/lib/config";

// Venue badges: Prologue uses its brand rust; Simply Books gets a neutral ink
// treatment until its own identity is confirmed (see README §Open questions).
export function VenueBadge({ location }: { location: Location }) {
  const prologue = location === "Prologue";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${
        prologue ? "bg-rust text-paper" : "bg-ink/80 text-paper"
      }`}
    >
      {prologue ? "Prologue" : "Simply Books"}
    </span>
  );
}

const DONE = ["Collected", "Shipped", "Cancelled", "Cancelled order", "Expired", "Already In Stock"];
const PROBLEM = ["Can't get", "Issue"];

export function StatusBadge({ status }: { status: string }) {
  let cls = "bg-shell text-rust-dark";
  if (NEEDS_ORDERING_STATUSES.includes(status)) cls = "bg-coral text-white";
  else if (PROBLEM.includes(status)) cls = "bg-blush text-rust-dark";
  else if (DONE.includes(status)) cls = "bg-ink/10 text-ink/60";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status || "—"}
    </span>
  );
}
