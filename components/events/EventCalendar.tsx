"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ShowEvent } from "@/lib/types";
import { eventStatus, fmtEventTime } from "@/lib/events";

const pad = (n: number) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Monday-first month grid; null cells pad the first/last week. */
function buildCells(year: number, month: number): (number | null)[] {
  const startDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export default function EventCalendar({ events }: { events: ShowEvent[] }) {
  const router = useRouter();
  const now = new Date();
  const [ym, setYm] = useState<[number, number]>([now.getFullYear(), now.getMonth() + 1]);
  const [year, month] = ym;
  const today = todayISO();

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYm([d.getFullYear(), d.getMonth() + 1]);
  };

  const arrow = (dir: -1 | 1) => (
    <button
      onClick={() => shift(dir)}
      aria-label={dir === -1 ? "Previous month" : "Next month"}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-cream-2 bg-white text-charcoal hover:border-ink"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={dir === 1 ? { transform: "scaleX(-1)" } : undefined}>
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );

  return (
    <div className="px-4 pb-10 pt-6 sm:px-8">
      <div className="mb-4 flex items-center gap-3.5">
        {arrow(-1)}
        <h2 className="m-0 min-w-[170px] font-display text-[22px]">{monthLabel}</h2>
        {arrow(1)}
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="mb-1.5 grid grid-cols-7 gap-1.5">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
              <div key={w} className="eyebrow px-1 text-stone">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {buildCells(year, month).map((day, i) => {
              if (!day) return <div key={i} />;
              const iso = `${year}-${pad(month)}-${pad(day)}`;
              const dayEvents = events.filter((e) => e.date === iso);
              return (
                <div
                  key={i}
                  className={`min-h-24 rounded-md border border-cream-2 bg-white p-1.5 ${iso === today ? "shadow-[inset_0_0_0_1.5px_var(--color-rust)]" : ""}`}
                >
                  <div className="mb-1 text-right text-xs font-semibold tabular-nums text-charcoal">{day}</div>
                  <div className="flex flex-col gap-[3px]">
                    {dayEvents.map((e) => {
                      const color = eventStatus(e.status).color;
                      return (
                        <button
                          key={e.id}
                          onClick={() => router.push(`/events/${e.id}`)}
                          title={e.name}
                          className="block w-full cursor-pointer overflow-hidden truncate whitespace-nowrap rounded px-1.5 py-[3px] text-left text-[11px] font-semibold leading-tight"
                          style={{ color, background: `${color}18`, borderLeft: `2px solid ${color}` }}
                        >
                          {e.time ? `${fmtEventTime(e.time)} · ` : ""}
                          {e.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
