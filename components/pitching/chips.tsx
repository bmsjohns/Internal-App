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

export function PriorityChip({ priority }: { priority: string }) {
  if (!priority) return <span className="text-xs text-stone">—</span>;
  const color = PRIORITY_COLORS[priority] ?? "#8C857C";
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-[3px] text-xs font-semibold"
      style={{ color, background: `${color}14`, borderColor: `${color}33` }}
    >
      {priority}
    </span>
  );
}

/** 1–5 star rating; pass onChange to make it editable. */
export function RatingStars({
  rating,
  onChange,
  size = 15,
}: {
  rating: number | null;
  onChange?: (r: number | null) => void;
  size?: number;
}) {
  if (!onChange && !rating) return <span className="text-xs text-stone">—</span>;
  return (
    <span className="inline-flex items-center gap-px" aria-label={rating ? `${rating} of 5` : "Unrated"}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (rating ?? 0) >= n;
        const star = (
          <svg
            key={n}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={filled ? "#B0812F" : "none"}
            stroke={filled ? "#B0812F" : "#B8B0A6"}
            strokeWidth="1.6"
            strokeLinejoin="round"
          >
            <path d="M12 2.5l2.95 6.2 6.55.85-4.8 4.7 1.2 6.75L12 17.8 6.1 21l1.2-6.75-4.8-4.7 6.55-.85z" />
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
