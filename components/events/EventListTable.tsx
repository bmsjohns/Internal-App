"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ShowEvent } from "@/lib/types";
import { fmtEventDate, fmtEventTime } from "@/lib/events";
import { getEventOperationsPreview, readinessSummary } from "@/lib/event-operations";
import { EventStatusChip, StaffingBadge } from "./chips";

/** List view — table on desktop, stacked cards at phone width (§0 mobile bar). */
export default function EventListTable({ events }: { events: ShowEvent[] }) {
  const router = useRouter();
  const open = (id: string) => router.push(`/events/${id}`);

  if (events.length === 0) {
    return <p className="px-5 py-14 text-center text-stone sm:px-8">No events match these filters.</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <table className="hidden w-full border-collapse text-sm md:table">
        <thead>
          <tr className="text-left">
            {["Event", "Date & time", "Venue", "Host", "Staffing", "Readiness", "Status"].map((h, i) => (
              <th
                key={h}
                className={`eyebrow sticky top-0 bg-cream px-4 py-3 font-semibold text-stone ${i === 0 ? "pl-8" : ""} ${i === 6 ? "pr-8 text-right" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-cream-2 transition-colors hover:bg-shell/60">
              <td className="py-[15px] pl-8 pr-4">
                <Link href={`/events/${e.id}`} className="block rounded-sm no-underline focus-visible:outline-2 focus-visible:outline-rust">
                  <div className="font-display text-base leading-tight">{e.name}</div>
                  <div className="mt-0.5 text-[12.5px] text-stone">
                    {e.leadTitle || "—"}{e.types.length > 0 && <> · {e.types.join(" · ")}</>}
                  </div>
                </Link>
              </td>
              <td className="whitespace-nowrap px-4 py-[15px]">
                <div className="font-semibold">{fmtEventDate(e.date)}</div>
                <div className="text-[12.5px] text-stone">{fmtEventTime(e.time) || "Time TBC"}</div>
              </td>
              <td className="px-4 py-[15px] text-[13.5px] text-charcoal">{e.venueName || "—"}</td>
              <td className="px-4 py-[15px] text-[13.5px] text-charcoal">{e.hostName || "—"}</td>
              <td className="px-4 py-[15px]">
                <StaffingBadge event={e} />
              </td>
              <td className="px-4 py-[15px]">
                <ReadinessBadge event={e} />
              </td>
              <td className="py-[15px] pl-4 pr-8 text-right">
                <EventStatusChip raw={e.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2.5 px-4 py-4 md:hidden">
        {events.map((e) => (
          <button
            key={e.id}
            onClick={() => open(e.id)}
            className="rounded-lg border border-cream-2 bg-white px-4 py-3.5 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-base leading-tight">{e.name}</div>
                <div className="mt-0.5 truncate text-[12.5px] text-stone">{e.leadTitle || "—"}</div>
              </div>
              <EventStatusChip raw={e.status} />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] text-charcoal">
              <span className="font-semibold">
                {fmtEventDate(e.date)}
                {e.time && <> · {fmtEventTime(e.time)}</>}
              </span>
              {e.venueName && <span className="text-stone">{e.venueName}</span>}
              <StaffingBadge event={e} />
              <ReadinessBadge event={e} />
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function ReadinessBadge({ event }: { event: ShowEvent }) {
  const operations = getEventOperationsPreview(event);
  const ready = readinessSummary(operations.tasks);
  const color = ready.overdue ? "#AD3B28" : ready.percent >= 80 ? "#5F7355" : "#B0812F";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-cream-2 bg-white px-2.5 py-1 text-[11px] font-semibold text-charcoal">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {ready.percent}%
      {ready.overdue > 0 && <span className="text-rust">· {ready.overdue} late</span>}
    </span>
  );
}
