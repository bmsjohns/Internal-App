"use client";

import type { ChipTone, TrendDelta } from "@/lib/dashboard";
import { gbpK, pctDelta } from "@/lib/dashboard";

// Chart + chip primitives for the Management Dashboard, drawn to the design
// file's spec: hand-rolled SVG (no chart library), Karla axis labels, brand
// colours per venue line.

export const icon = (path: string, size = 19) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    dangerouslySetInnerHTML={{ __html: path }}
  />
);

export const ICONS = {
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0"/><path d="M16 5.5a3 3 0 010 5.5M15 20a6 6 0 015-5.7"/>',
  ret: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 015 5 5 5 0 01-5 5H8"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M8 8h8M8 12h8"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
  send: '<path d="M4 12l16-8-6 16-3-6z"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  inbox: '<path d="M4 13l2.2-8h11.6L20 13v6H4z"/><path d="M4 13h4.5l1.2 2h4.6l1.2-2H20"/>',
  box: '<path d="M3 8l9-4 9 4-9 4z"/><path d="M3 8v8l9 4 9-4V8"/><path d="M12 12v8"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  tag: '<path d="M4 4h8l8 8-8 8-8-8z"/><circle cx="8.5" cy="8.5" r="1.4"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  dn: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  arrowUR: '<path d="M7 17L17 7M8 7h9v9"/>',
  arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
} as const;

export const CHIP_TONES: Record<ChipTone, { fg: string; bg: string }> = {
  warn: { fg: "#B23A2A", bg: "#FBE3DF" },
  action: { fg: "#AD3B28", bg: "#FBEDEA" },
  slow: { fg: "#8A5A12", bg: "#FBF1DA" },
  good: { fg: "#2A6B5A", bg: "#E1F0EB" },
  quiet: { fg: "#3A322C", bg: "#E8E3DA" },
};

export function Chip({ text, tone }: { text: string; tone: ChipTone }) {
  const t = CHIP_TONES[tone];
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-[9px] py-[3px] text-[10.5px] font-bold tracking-[.02em]"
      style={{ color: t.fg, background: t.bg }}
    >
      {text}
    </span>
  );
}

/** Prior-period % pill — green up / red down (design's `delta`). */
export function DeltaPill({ cur, prev, muted }: { cur: number; prev: number | null | undefined; muted?: boolean }) {
  const pct = pctDelta(cur, prev);
  if (pct == null) return <span className="text-[11px] text-stone">—</span>;
  const rise = pct >= 0;
  const t = rise ? CHIP_TONES.good : CHIP_TONES.warn;
  return (
    <span
      className="inline-flex items-center gap-[3px] rounded-full px-[7px] py-[2px] text-[11px] font-bold tabular-nums"
      style={{ color: t.fg, background: t.bg, opacity: muted ? 0.9 : 1 }}
    >
      {icon(rise ? ICONS.up : ICONS.dn, 12)}
      {rise ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

export function TrendDeltaPill({ delta }: { delta: TrendDelta }) {
  const t = delta.good ? CHIP_TONES.good : CHIP_TONES.warn;
  return (
    <span
      className="inline-flex items-center gap-[3px] rounded-full px-[7px] py-[2px] text-[11px] font-bold tabular-nums"
      style={{ color: t.fg, background: t.bg }}
    >
      {icon(delta.dir === "up" ? ICONS.up : ICONS.dn, 12)}
      {delta.text}
    </span>
  );
}

export interface LineSeries {
  data: number[];
  color: string;
  width: number;
}

export function LineChart({ series, labels }: { series: LineSeries[]; labels: { idx: number; t: string }[] }) {
  const w = 760;
  const h = 280;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 30;
  const iw = w - padL - padR;
  const ih = h - padT - padB;
  const n = Math.max(2, series[0]?.data.length ?? 2);
  let max = 0;
  for (const s of series) for (const v of s.data) if (v > max) max = v;
  max = max * 1.14 || 1;
  const X = (i: number) => padL + (iw * i) / (n - 1);
  const Y = (v: number) => padT + ih * (1 - v / max);
  const grid = [0, 1, 2, 3, 4].map((k) => ({ v: (max * k) / 4, y: Y((max * k) / 4) }));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="auto" preserveAspectRatio="xMidYMid meet" className="block overflow-visible" role="img" aria-label="Daily revenue trend">
      {grid.map((g) => (
        <g key={g.v}>
          <line x1={padL} y1={g.y} x2={w - padR} y2={g.y} stroke="#E7E1D6" strokeWidth="1" />
          <text x={padL - 9} y={g.y + 3.5} textAnchor="end" fontFamily="var(--font-sans)" fontSize="10.5" fill="#8C857C">
            {gbpK(g.v)}
          </text>
        </g>
      ))}
      {labels.map((l) => (
        <text key={l.idx} x={X(l.idx)} y={h - 9} textAnchor="middle" fontFamily="var(--font-sans)" fontSize="10.5" fill="#8C857C">
          {l.t}
        </text>
      ))}
      {series.map((s, si) => {
        const d = s.data.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
        return <path key={si} d={d} fill="none" stroke={s.color} strokeWidth={s.width} strokeLinejoin="round" strokeLinecap="round" />;
      })}
    </svg>
  );
}

export function Spark({ data, color }: { data: number[]; color: string }) {
  const w = 150;
  const h = 46;
  const n = Math.max(2, data.length);
  let mx = Math.max(...data);
  const mn = Math.min(...data);
  if (mx === mn) mx = mn + 1;
  const X = (i: number) => 3 + ((w - 6) * i) / (n - 1);
  const Y = (v: number) => 4 + (h - 8) * (1 - (v - mn) / (mx - mn));
  const d = data.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const area = `${d} L${X(n - 1).toFixed(1)} ${h} L${X(0).toFixed(1)} ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="46" preserveAspectRatio="none" className="block" aria-hidden>
      <path d={area} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Bars({ items, color }: { items: { label: string; value: number; disp: string; share?: number }[]; color?: string | string[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-[11px]">
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center gap-[11px]">
          <div className="w-[104px] shrink-0 truncate text-right text-xs text-charcoal">{it.label}</div>
          <div className="h-[9px] flex-1 overflow-hidden rounded-full bg-cream-2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${((it.share ?? (it.value / max) * 100)).toFixed(1)}%`,
                background: Array.isArray(color) ? color[i % color.length] : (color ?? "#AD3B28"),
              }}
            />
          </div>
          <div className="w-[92px] shrink-0 text-right text-xs font-semibold tabular-nums">
            {it.disp}
            {it.share != null && <span className="font-medium text-stone"> {Math.round(it.share)}%</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
