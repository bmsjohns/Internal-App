"use client";

import type { ReturnRequest, ReturnStatus } from "@/lib/types";
import { RETURN_STATUSES, statusIndex } from "@/lib/returns";

// The Orders V2 clickable timeline pattern, horizontal (design: rt-step).
// Forward is one step at a time (each step has its own validated action);
// any earlier step is clickable and asks the parent to confirm a revert.

const dateFor = (r: ReturnRequest, key: ReturnStatus): string | null => {
  switch (key) {
    case "requested":
      return r.dateRequested;
    case "awaiting":
      return r.dateSubmitted;
    case "approved":
      return r.dateApproved;
    case "shipped":
      return r.dateShipped;
    case "credit":
      return r.dateCreditConfirmed;
  }
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";

export default function ReturnTimeline({
  r,
  accent,
  onStep,
}: {
  r: ReturnRequest;
  accent: string;
  onStep: (target: ReturnStatus, direction: "forward" | "back" | "blocked") => void;
}) {
  const cur = statusIndex(r.status);
  return (
    <div className="flex items-start overflow-x-auto pb-1.5">
      {RETURN_STATUSES.map((s, i) => {
        const done = i < cur;
        const isCur = i === cur;
        const reachable = i <= cur || i === cur + 1;
        return (
          <div key={s.key} className="relative flex min-w-[110px] flex-1 flex-col items-center">
            {i > 0 && (
              <span
                className="absolute right-1/2 top-[13px] h-[2.5px] w-full"
                style={{ background: i <= cur ? accent : "var(--color-cream-2)" }}
              />
            )}
            <button
              onClick={() =>
                isCur ? undefined : onStep(s.key, i < cur ? "back" : i === cur + 1 ? "forward" : "blocked")
              }
              className="group relative z-[1] flex flex-col items-center gap-2 border-none bg-transparent p-0"
              style={{ cursor: reachable && !isCur ? "pointer" : "default" }}
              title={
                isCur
                  ? "Current stage"
                  : done
                    ? `Move back to ${s.label}`
                    : i === cur + 1
                      ? `Move to ${s.label}`
                      : "Move one step at a time"
              }
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full transition-transform group-hover:scale-110"
                style={
                  done
                    ? { background: accent, color: "#fff" }
                    : isCur
                      ? { background: "#fff", border: `2.5px solid ${accent}`, color: accent }
                      : { background: "#fff", border: "2px solid var(--color-cream-2)", color: "var(--color-stone)" }
                }
              >
                {done ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 6" />
                  </svg>
                ) : isCur ? (
                  <span className="h-[9px] w-[9px] rounded-full" style={{ background: accent }} />
                ) : (
                  <span className="text-xs font-semibold">{i + 1}</span>
                )}
              </span>
              <span
                className="whitespace-nowrap text-center text-xs font-semibold"
                style={{ color: done || isCur ? "var(--color-ink)" : "var(--color-stone)" }}
              >
                {s.label}
              </span>
              <span className="text-center text-[11px] tabular-nums text-stone">{fmt(dateFor(r, s.key))}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
