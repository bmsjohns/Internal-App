"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Pitch } from "@/lib/types";
import { PITCH_STAGES, pitchStage, type PitchStage } from "@/lib/pitching";
import { LeadDot, PriorityChip, RatingStars } from "./chips";

const GRIP = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
  </svg>
);

/**
 * Kanban board (§3.1), laid out per the Claude Design file: white columns
 * with a stage-coloured top border, hint line under each column label, and
 * cream cards (priority pill + grip, display-face title, publisher line,
 * stars + lead footer). Cards move by drag-and-drop; the same status write
 * is available from the stage select on the pitch's edit screen, which
 * covers touch devices. Both only ever write existing Airtable options.
 */
export default function PitchBoard({
  pitches,
  onMove,
}: {
  pitches: Pitch[];
  onMove: (pitch: Pitch, stage: PitchStage) => void;
}) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const byStage = new Map<string, Pitch[]>(PITCH_STAGES.map((s) => [s.key, []]));
  for (const p of pitches) byStage.get(pitchStage(p.status).key)!.push(p);

  function drop(stage: PitchStage) {
    const pitch = pitches.find((p) => p.id === dragId);
    setDragId(null);
    setOverKey(null);
    if (pitch && pitchStage(pitch.status).key !== stage.key) onMove(pitch, stage);
  }

  return (
    <div className="flex items-start gap-[18px] overflow-x-auto px-5 pb-8 pt-[22px] sm:px-8">
      {PITCH_STAGES.map((stage) => {
        const cards = byStage.get(stage.key)!;
        return (
          <section
            key={stage.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOverKey(stage.key);
            }}
            onDragLeave={() => setOverKey((k) => (k === stage.key ? null : k))}
            onDrop={() => drop(stage)}
            className={`flex w-[288px] shrink-0 flex-col rounded-lg border bg-white transition-colors ${
              overKey === stage.key && dragId ? "border-rust" : "border-cream-2"
            }`}
            style={{ borderTop: `3px solid ${stage.color}` }}
          >
            <header className="border-b border-cream-2 px-4 pb-[11px] pt-[13px]">
              <div className="flex items-center justify-between">
                <span className="font-display text-base text-ink">{stage.label}</span>
                <span className="rounded-full bg-cream px-[9px] py-px text-xs font-semibold tabular-nums text-stone">
                  {cards.length}
                </span>
              </div>
              <div className="mt-0.5 text-[11.5px] text-stone">{stage.hint}</div>
            </header>
            <div className="flex min-h-14 flex-col gap-2.5 overflow-y-auto p-3">
              {cards.map((p) => {
                const title = p.bookTitle || p.authorName;
                const pubLine =
                  [p.publisherNames[0], p.imprintNames[0]].filter(Boolean).join(" · ") || "No publisher yet";
                return (
                  <article
                    key={p.id}
                    draggable
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverKey(null);
                    }}
                    onClick={() => router.push(`/pitching/${p.id}`)}
                    title={p.status !== stage.writeAs ? `Airtable status: ${p.status}` : undefined}
                    className={`cursor-pointer rounded-[7px] border border-cream-2 bg-cream px-3.5 py-[13px] transition-opacity hover:bg-shell/60 ${
                      dragId === p.id ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <PriorityChip priority={p.priority} />
                      <span className="shrink-0 text-[#C9C1B5]">{GRIP}</span>
                    </div>
                    <div className="mt-[9px] font-display text-base leading-[1.15] text-ink">{title}</div>
                    {p.bookTitle && <div className="mt-0.5 text-[13px] text-charcoal">{p.authorName}</div>}
                    <div className="mt-2 text-xs text-stone">{pubLine}</div>
                    <div className="mt-[11px] flex items-center justify-between border-t border-cream-2 pt-2.5">
                      <RatingStars rating={p.rating} />
                      <LeadDot name={p.leadName} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
