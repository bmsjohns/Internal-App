"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Pitch } from "@/lib/types";
import { PITCH_STAGES, pitchStage, type PitchStage } from "@/lib/pitching";
import { PriorityChip, RatingStars } from "./chips";

/**
 * Kanban board (§3.1): columns are canonical stages, cards move by
 * drag-and-drop (desktop) or the per-card stage dropdown (works everywhere,
 * incl. touch — native HTML5 DnD doesn't fire on touch screens). Both write
 * the stage's `writeAs` — an existing Airtable option.
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
    <div className="flex h-full gap-3 overflow-x-auto px-5 pb-6 pt-5 sm:px-8">
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
            className={`flex w-[248px] shrink-0 flex-col rounded-lg border transition-colors ${
              overKey === stage.key && dragId ? "border-rust bg-shell/60" : "border-cream-2 bg-white/60"
            }`}
          >
            <header className="flex items-center gap-2 px-3 pb-2 pt-3">
              <span className="h-[9px] w-[9px] rounded-full" style={{ background: stage.color }} />
              <span className="text-[12.5px] font-semibold text-charcoal">{stage.label}</span>
              <span className="ml-auto text-[11px] tabular-nums text-stone">{cards.length}</span>
            </header>
            <div className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {cards.map((p) => (
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
                  className={`cursor-pointer rounded-md border border-cream-2 bg-white p-3 shadow-[0_1px_2px_rgba(26,23,20,0.05)] transition-opacity hover:border-stone ${
                    dragId === p.id ? "opacity-40" : ""
                  }`}
                >
                  <div className="text-[13.5px] font-semibold leading-snug text-ink">{p.authorName}</div>
                  {p.bookTitle && <div className="mt-0.5 line-clamp-2 text-[12.5px] text-charcoal">{p.bookTitle}</div>}
                  {(p.imprintNames.length > 0 || p.publisherNames.length > 0) && (
                    <div className="mt-1 truncate text-[11.5px] text-stone">
                      {p.imprintNames[0] ?? p.publisherNames[0]}
                      {p.imprintNames[0] && p.publisherNames[0] && p.imprintNames[0] !== p.publisherNames[0] && (
                        <span> · {p.publisherNames[0]}</span>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <PriorityChip priority={p.priority} />
                    <RatingStars rating={p.rating} size={13} />
                  </div>
                  <select
                    value={stage.key}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const next = PITCH_STAGES.find((s) => s.key === e.target.value);
                      if (next) onMove(p, next);
                    }}
                    className="mt-2 w-full cursor-pointer rounded border border-cream-2 bg-cream px-1.5 py-1 text-[11.5px] text-charcoal"
                    aria-label="Move to stage"
                  >
                    {PITCH_STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
