import { canonicalStatus, PAID_COLORS, VENUES, venueKeyOf, initialsOf } from "@/lib/config";
import type { Location } from "@/lib/types";

/** Status chip: dot + tinted pill in the canonical status colour. */
export function StatusChip({ raw }: { raw: string }) {
  const s = canonicalStatus(raw);
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

export function PaidChip({ paid }: { paid: string }) {
  const c = PAID_COLORS[paid] ?? "#8C857C";
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-[3px] text-xs font-semibold"
      style={{ color: c, background: `${c}14`, borderColor: `${c}33` }}
    >
      {paid || "—"}
    </span>
  );
}

export function VenueDot({ location, size = 8 }: { location: Location; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: VENUES[venueKeyOf(location)].color }}
    />
  );
}

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-shell text-xs font-semibold text-rust"
      style={{ width: size, height: size }}
    >
      {initialsOf(name || "?")}
    </span>
  );
}
