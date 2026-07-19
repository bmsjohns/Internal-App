import type { Location } from "@/lib/types";

export function exportLocation(value: string | null): Location | null {
  return value === "Simply Books" || value === "Prologue" ? value : null;
}

export function exportFilename(location: Location | null, date: string): string {
  const scope = location ? location.toLowerCase().replace(/\s+/g, "-") : "both-venues";
  return `${scope}-to-order-${date}.xlsx`;
}

/** Excel worksheet names are capped at 31 characters and must be unique. */
export function uniqueWorksheetName(raw: string, used: Set<string>): string {
  const base = raw.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Sheet";
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLocaleLowerCase())) {
    const marker = ` (${suffix++})`;
    candidate = `${base.slice(0, 31 - marker.length)}${marker}`;
  }
  used.add(candidate.toLocaleLowerCase());
  return candidate;
}
