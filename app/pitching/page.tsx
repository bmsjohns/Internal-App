"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Pitch } from "@/lib/types";
import { PITCH_PRIORITIES, PITCH_STAGES, pitchStage, type PitchStage } from "@/lib/pitching";
import PageHeader, { btnPrimary } from "@/components/PageHeader";
import PitchBoard from "@/components/pitching/PitchBoard";
import PitchList from "@/components/pitching/PitchList";

type View = "board" | "list";

/**
 * Pitching pipeline (§3.1 / §3.1a): board and list are two views of the SAME
 * fetched data with shared filters — a toggle, not two screens that drift.
 */
export default function PitchingPage() {
  const [pitches, setPitches] = useState<Pitch[] | null>(null);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [view, setView] = useState<View>("board");
  const [priority, setPriority] = useState("all");
  const [stageKey, setStageKey] = useState("all"); // list-view filter (§3.1a)
  const [publisher, setPublisher] = useState("all"); // list-view filter (§3.1a)

  useEffect(() => {
    fetch("/api/pitches")
      .then((r) => {
        if (r.status === 403) {
          setDenied(true);
          return { pitches: [] };
        }
        return r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`));
      })
      .then((d) => setPitches(d.pitches))
      .catch((e) => setError(e.message));
  }, []);

  const publishers = useMemo(() => {
    const set = new Set<string>();
    for (const p of pitches ?? []) for (const n of p.publisherNames) set.add(n);
    return [...set].sort();
  }, [pitches]);

  const filtered = useMemo(() => {
    return (pitches ?? []).filter((p) => {
      if (priority !== "all" && p.priority !== priority) return false;
      if (view === "list" && stageKey !== "all" && pitchStage(p.status).key !== stageKey) return false;
      if (view === "list" && publisher !== "all" && !p.publisherNames.includes(publisher)) return false;
      return true;
    });
  }, [pitches, priority, stageKey, publisher, view]);

  // Board moves: optimistic update, write the stage's existing Airtable option.
  async function move(pitch: Pitch, stage: PitchStage) {
    const prev = pitches;
    setPitches((ps) => (ps ?? []).map((p) => (p.id === pitch.id ? { ...p, status: stage.writeAs } : p)));
    try {
      const res = await fetch(`/api/pitches/${pitch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: stage.writeAs }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPitches(prev); // roll back on failure
      setError(`Couldn’t move ${pitch.authorName} — try again.`);
      setTimeout(() => setError(""), 4000);
    }
  }

  if (denied) {
    return (
      <div className="ob-screen flex min-h-screen flex-col">
        <PageHeader eyebrow="Events" title="Pitching" />
        <div className="flex flex-col items-center justify-center px-5 py-24 text-center">
          <Image src="/assets/bird-perched.png" alt="" width={120} height={98} className="mb-[18px] h-auto w-[120px] opacity-90" />
          <div className="font-display text-2xl text-ink">This one’s a small-team area.</div>
          <p className="mt-2 max-w-[380px] text-charcoal">
            Event pitching is limited to a small group. Ask Ben if you need access — it’s a one-line change in Clerk.
          </p>
        </div>
      </div>
    );
  }

  const segBtn = (active: boolean) =>
    `cursor-pointer rounded-md border px-3.5 py-2 text-[12.5px] font-semibold ${
      active ? "border-rust bg-shell text-rust" : "border-cream-2 bg-white text-charcoal"
    }`;

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      <PageHeader
        eyebrow="Events · Phase 1"
        title="Pitching"
        actions={
          <Link href="/pitching/new" className={btnPrimary}>
            + New pitch
          </Link>
        }
      >
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex gap-1" role="tablist" aria-label="View">
            <button role="tab" aria-selected={view === "board"} onClick={() => setView("board")} className={segBtn(view === "board")}>
              Board
            </button>
            <button role="tab" aria-selected={view === "list"} onClick={() => setView("list")} className={segBtn(view === "list")}>
              List
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => setPriority("all")} className={`whitespace-nowrap rounded-full border px-[13px] py-[7px] text-[12.5px] font-semibold ${priority === "all" ? "border-rust bg-rust text-cream" : "border-cream-2 bg-white text-charcoal"}`}>
              All priorities
            </button>
            {PITCH_PRIORITIES.map((p) => (
              <button key={p} onClick={() => setPriority(p)} className={`whitespace-nowrap rounded-full border px-[13px] py-[7px] text-[12.5px] font-semibold ${priority === p ? "border-rust bg-rust text-cream" : "border-cream-2 bg-white text-charcoal"}`}>
                {p}
              </button>
            ))}
          </div>
          {view === "list" && (
            <>
              <select value={stageKey} onChange={(e) => setStageKey(e.target.value)} className="cursor-pointer rounded-md border border-cream-2 bg-white px-2.5 py-2 text-[12.5px] font-semibold text-charcoal">
                <option value="all">All stages</option>
                {PITCH_STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select value={publisher} onChange={(e) => setPublisher(e.target.value)} className="cursor-pointer rounded-md border border-cream-2 bg-white px-2.5 py-2 text-[12.5px] font-semibold text-charcoal">
                <option value="all">All publishers</option>
                {publishers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-auto">
        {error && <p className="px-8 pt-4 text-sm font-semibold text-coral">{error}</p>}
        {!pitches && !error && <p className="p-8 text-stone">Loading…</p>}
        {pitches && view === "board" && <PitchBoard pitches={filtered} onMove={move} />}
        {pitches && view === "list" && <PitchList pitches={filtered} />}
      </div>

      <div className="flex justify-between border-t border-cream-2 bg-white px-5 py-[11px] text-[12.5px] text-stone sm:px-8">
        <span>
          {filtered.length} pitch{filtered.length === 1 ? "" : "es"}
        </span>
        <span>Airtable · Events › Event Pitching</span>
      </div>
    </div>
  );
}
