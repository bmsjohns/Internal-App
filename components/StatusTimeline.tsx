"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StatusLogEntry } from "@/lib/types";
import { canonicalStatus, CANONICAL_STATUSES } from "@/lib/config";

// V3 §5: clickable status control. The workflow is NOT strictly linear —
// "Ordered" and "In store" are mutually exclusive alternatives at the same
// stage (a book is either ordered in, or it was already on the shelf), so
// stage 2 is a branch: two pills, pick one. Off-path outcomes (Can't get /
// Cancelled) sit apart from the main line. Every change is recorded with
// who + when (§5 audit trail) and shown as history below.

type Stage = { keys: string[]; note?: string };
const STAGES: Stage[] = [
  { keys: ["needs-ordering"] },
  { keys: ["ordered", "in-store"], note: "one or the other" },
  { keys: ["ready"] },
  { keys: ["collected"] },
];
const OFF_PATH = ["cant-get", "cancelled"];

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function StatusTimeline({
  orderId,
  rawStatus,
  lastModified,
  log,
}: {
  orderId: string;
  rawStatus: string;
  lastModified: string;
  log: StatusLogEntry[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const currentKey = canonicalStatus(rawStatus).key;
  const stageIdx = STAGES.findIndex((s) => s.keys.includes(currentKey));

  async function setStatus(key: string) {
    if (key === currentKey || busy) return;
    setBusy(true);
    setError("");
    const writeAs = CANONICAL_STATUSES.find((s) => s.key === key)!.writeAs;
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: writeAs }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn’t update status");
    }
    setBusy(false);
  }

  const pill = (key: string, active: boolean, done: boolean) => {
    const s = CANONICAL_STATUSES.find((x) => x.key === key)!;
    return (
      <button
        key={key}
        onClick={() => setStatus(key)}
        disabled={busy}
        title={active ? "Current status" : `Move to ${s.label}`}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-60 ${
          active ? "" : "hover:border-ink"
        }`}
        style={
          active
            ? { color: "#fff", background: s.color, borderColor: s.color }
            : done
              ? { color: s.color, background: `${s.color}14`, borderColor: `${s.color}55` }
              : { color: "var(--color-charcoal)", background: "#fff", borderColor: "var(--color-cream-2)" }
        }
      >
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: active ? "#fff" : s.color }} />
        {s.label}
      </button>
    );
  };

  return (
    <div>
      <div className="flex flex-col">
        {STAGES.map((stage, i) => {
          const active = i === stageIdx;
          const done = stageIdx > i;
          return (
            <div key={i} className="flex gap-3.5">
              <div className="flex shrink-0 flex-col items-center pt-[7px]">
                <span
                  className="h-3.5 w-3.5 rounded-full border-2"
                  style={{
                    background: done || active ? CANONICAL_STATUSES.find((s) => s.key === (active ? currentKey : stage.keys[0]))!.color : "#fff",
                    borderColor: done || active ? "transparent" : "#D8D1C6",
                  }}
                />
                {i < STAGES.length - 1 && (
                  <span className="min-h-5 w-0.5 flex-1" style={{ background: done ? "#c9c2b6" : "#E3DCD1" }} />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pb-4">
                {stage.keys.map((k) => pill(k, active && k === currentKey, done))}
                {stage.note && <span className="ml-1 text-[11px] italic text-stone">{stage.note}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <span className="eyebrow mr-1 text-stone">Or</span>
        {OFF_PATH.map((k) => pill(k, currentKey === k, false))}
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-coral">{error}</p>}

      <div className="mt-7">
        <div className="eyebrow mb-2.5 text-stone">History</div>
        {log.length === 0 ? (
          <p className="text-[13px] text-stone">
            No changes recorded yet — history starts with the first status change.
            {` Last touched ${fmt(lastModified)}.`}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {[...log].reverse().map((e, i) => {
              const s = canonicalStatus(e.status);
              return (
                <li key={i} className="flex items-baseline gap-2 text-[13px]">
                  <span className="h-[7px] w-[7px] shrink-0 translate-y-px rounded-full" style={{ background: s.color }} />
                  <span className="font-semibold text-ink">{s.label}</span>
                  <span className="text-stone">
                    {e.by} · {fmt(e.at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
