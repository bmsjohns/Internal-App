import { pitchStage, PRIORITY_COLORS } from "@/lib/pitching";

/** Stage chip: dot + tinted pill in the canonical pitch-stage colour. */
export function StageChip({ raw }: { raw: string }) {
  const s = pitchStage(raw);
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

/** Priority pill with dot — geometry and tint per the design file's cards. */
export function PriorityChip({ priority }: { priority: string }) {
  if (!priority) return <span className="text-xs text-stone">—</span>;
  const color = PRIORITY_COLORS[priority] ?? "#8C857C";
  return (
    <span
      className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-2 py-[2px] text-[11px] font-semibold"
      style={{ color, background: `${color}14`, borderColor: `${color}33` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {priority}
    </span>
  );
}

/** 1–5 stars, rust fill per the design file; pass onChange to make it editable. */
export function RatingStars({
  rating,
  onChange,
  size = 14,
}: {
  rating: number | null;
  onChange?: (r: number | null) => void;
  size?: number;
}) {
  if (!onChange && !rating) return <span className="text-xs text-stone">—</span>;
  return (
    <span className="inline-flex items-center gap-px" aria-label={rating ? `${rating} of 5` : "Unrated"}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (rating ?? 0) >= n;
        const star = (
          <svg
            key={n}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={on ? "#AD3B28" : "none"}
            stroke={on ? "#AD3B28" : "#CBC3B6"}
            strokeWidth="1.5"
          >
            <polygon points="12,3 14.7,8.6 21,9.3 16.3,13.6 17.6,20 12,16.8 6.4,20 7.7,13.6 3,9.3 9.3,8.6" />
          </svg>
        );
        if (!onChange) return star;
        return (
          <button
            key={n}
            type="button"
            // clicking the current rating clears it
            onClick={() => onChange(rating === n ? null : n)}
            className="cursor-pointer bg-transparent p-0.5"
            aria-label={`Rate ${n} of 5`}
          >
            {star}
          </button>
        );
      })}
    </span>
  );
}

/** Small initials avatar for the pitch lead (pink-pale/red on cards). */
export function LeadDot({ name, size = 24 }: { name: string; size?: number }) {
  if (!name) return null;
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span
      title={name}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-shell text-[10.5px] font-semibold text-rust"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}
