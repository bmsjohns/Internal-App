import { eventStatus, phaseMeta, staffingSummary } from "@/lib/events";
import type { EventPhase, ShowEvent } from "@/lib/types";

/** Event status chip: dot + tinted pill in the canonical status colour. */
export function EventStatusChip({ raw }: { raw: string }) {
  const s = eventStatus(raw);
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border py-[3px] pl-2 pr-2.5 text-xs font-semibold"
      style={{ color: s.color, background: `${s.color}14`, borderColor: `${s.color}33` }}
    >
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

/** "4/9 roles" staffing state, green when fully staffed, ochre otherwise. */
export function StaffingBadge({ event }: { event: Pick<ShowEvent, "roles"> }) {
  const s = staffingSummary(event);
  const color = s.total === 0 ? "#8C857C" : s.complete ? "#5F7355" : "#B0812F";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold" style={{ color }}>
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: color }} />
      {s.label}
    </span>
  );
}

/** "Pre show · Signing table" tag in the phase colour. */
export function PhaseTag({ phase, children }: { phase: EventPhase; children: React.ReactNode }) {
  const m = phaseMeta(phase);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-xs"
      style={{ color: m.color, background: `${m.color}14`, borderColor: `${m.color}33` }}
    >
      {m.label} · {children}
    </span>
  );
}
