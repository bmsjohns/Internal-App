"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Pitch } from "@/lib/types";
import { PITCH_PRIORITIES, PITCH_STAGES, pitchStage, type PitchSortKey } from "@/lib/pitching";
import { PriorityChip, RatingStars, StageChip } from "./chips";

const COLUMNS: { key: PitchSortKey; label: string; extra?: string }[] = [
  { key: "authorName", label: "Author" },
  { key: "bookTitle", label: "Book title" },
  { key: "status", label: "Stage" },
  { key: "priority", label: "Priority" },
  { key: "publicationDate", label: "Pub. date" },
  { key: "rating", label: "Rating" },
];

const stageOrder = new Map(PITCH_STAGES.map((s, i) => [s.key, i]));
const priorityOrder = new Map<string, number>(PITCH_PRIORITIES.map((p, i) => [p, i]));

function compare(a: Pitch, b: Pitch, key: PitchSortKey): number {
  switch (key) {
    case "status":
      return (stageOrder.get(pitchStage(a.status).key) ?? 0) - (stageOrder.get(pitchStage(b.status).key) ?? 0);
    case "priority":
      // unset priorities sort last
      return (priorityOrder.get(a.priority) ?? 99) - (priorityOrder.get(b.priority) ?? 99);
    case "publicationDate":
      return (a.publicationDate ?? "9999").localeCompare(b.publicationDate ?? "9999");
    case "rating":
      return (b.rating ?? 0) - (a.rating ?? 0); // default: best first
    default:
      return a[key].localeCompare(b[key], undefined, { sensitivity: "base" });
  }
}

/** Sortable list view of the same pitch data as the board (§3.1a). */
export default function PitchList({ pitches }: { pitches: Pitch[] }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<PitchSortKey>("authorName");
  const [dir, setDir] = useState<1 | -1>(1);

  const sorted = useMemo(
    () => [...pitches].sort((a, b) => compare(a, b, sortKey) * dir),
    [pitches, sortKey, dir]
  );

  function toggleSort(key: PitchSortKey) {
    if (key === sortKey) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setDir(1);
    }
  }

  return (
    <div className="overflow-x-auto px-5 pb-6 pt-4 sm:px-8">
      <table className="w-full min-w-[760px] border-separate border-spacing-0">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                className="cursor-pointer select-none border-b border-cream-2 px-3 py-2 text-left"
              >
                <span className="eyebrow inline-flex items-center gap-1 text-charcoal">
                  {c.label}
                  {sortKey === c.key && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      {dir === 1 ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}
                    </svg>
                  )}
                </span>
              </th>
            ))}
            <th className="border-b border-cream-2 px-3 py-2 text-left">
              <span className="eyebrow text-charcoal">Imprint / Publisher</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr
              key={p.id}
              onClick={() => router.push(`/pitching/${p.id}`)}
              className="cursor-pointer bg-white hover:bg-shell/40"
            >
              <td className="border-b border-cream-2 px-3 py-2.5 text-[13.5px] font-semibold text-ink">
                {p.authorName}
                {p.initialHighPriority && (
                  <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-[0.1em] text-rust" title="Initial high priority">
                    ★
                  </span>
                )}
              </td>
              <td className="max-w-64 truncate border-b border-cream-2 px-3 py-2.5 text-[13px] text-charcoal">
                {p.bookTitle || <span className="text-stone">—</span>}
              </td>
              <td className="border-b border-cream-2 px-3 py-2.5">
                <StageChip raw={p.status} />
              </td>
              <td className="border-b border-cream-2 px-3 py-2.5">
                <PriorityChip priority={p.priority} />
              </td>
              <td className="whitespace-nowrap border-b border-cream-2 px-3 py-2.5 text-[13px] tabular-nums text-charcoal">
                {p.publicationDate
                  ? new Date(p.publicationDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : "—"}
              </td>
              <td className="border-b border-cream-2 px-3 py-2.5">
                <RatingStars rating={p.rating} size={13} />
              </td>
              <td className="max-w-56 truncate border-b border-cream-2 px-3 py-2.5 text-[13px] text-charcoal">
                {p.imprintNames.join(", ") || p.publisherNames.join(", ") || <span className="text-stone">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
