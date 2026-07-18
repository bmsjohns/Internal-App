"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  BriefingEvent,
  BriefingVenueTheme,
  VenueBriefing,
  WrapDraft,
  WrapUp,
} from "@/lib/briefing";
import { fmtMin, onShiftNow } from "@/lib/briefing";
import { initialsOf } from "@/lib/config";

// The per-venue column cells, one component per design row. The page lays
// them out column-major in the DOM (whole venue, then the next) so phones
// read one shop at a time; on lg+ the parent becomes a grid and each cell's
// inline gridColumn/gridRow snaps the two venues into aligned rows — the
// design's "row-aligned" columns — with no duplicate markup.

export const ic = (p: string, sz = 19) => (
  <svg
    width={sz}
    height={sz}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    dangerouslySetInnerHTML={{ __html: p }}
  />
);

export const ICONS = {
  chevD: '<path d="M6 9l6 6 6-6"/>',
  chevU: '<path d="M6 15l6-6 6 6"/>',
  chevR: '<path d="M9 18l6-6-6-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M5 12l4 4L19 7"/>',
  edit: '<path d="M4 20h4L18 10l-4-4L4 16z"/><path d="M13 5l4 4"/>',
  rewind: '<path d="M11 19l-7-7 7-7v14zM20 19l-7-7 7-7v14z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};

export interface CellPos {
  col: number; // 1-based grid column on lg+
  row: number;
}

function Cell({ pos, children }: { pos: CellPos; children: React.ReactNode }) {
  return <div style={{ gridColumn: pos.col, gridRow: pos.row }}>{children}</div>;
}

function SectionHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h3 className="m-0 font-display text-lg text-ink">{title}</h3>
      {right}
    </div>
  );
}

export function Skeleton({ pos, h }: { pos: CellPos; h: number }) {
  return (
    <Cell pos={pos}>
      <div className="animate-pulse rounded-lg border border-cream-2 bg-white/60" style={{ height: h }} />
    </Cell>
  );
}

// ---------------------------------------------------------------------------
// Row 1 — brand header band (wordmark + who's on now)
// ---------------------------------------------------------------------------
export function BrandHeader({
  pos,
  theme,
  data,
  nowMin,
  isToday,
}: {
  pos: CellPos;
  theme: BriefingVenueTheme;
  data: VenueBriefing;
  nowMin: number;
  isToday: boolean;
}) {
  const onNow = isToday ? data.roster.filter((s) => onShiftNow(s, nowMin)) : [];
  return (
    <Cell pos={pos}>
      <div
        className="flex items-center justify-between gap-4 rounded-[10px] px-4 py-4 shadow-sm sm:px-[22px]"
        style={{ background: theme.accent }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            role="img"
            aria-label={theme.name}
            className="block shrink-0 bg-contain bg-left bg-no-repeat"
            style={{ width: theme.wmW, height: theme.wmH, backgroundImage: `url(${theme.wordmark})` }}
          />
          <div className="h-[26px] w-px bg-white/25" />
          <div className="truncate text-[11px] tracking-[.05em]" style={{ color: theme.soft }}>
            {theme.place}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center">
            {onNow.slice(0, 4).map((s, j) => (
              <span
                key={s.id}
                className="relative flex h-8 w-8 items-center justify-center rounded-full font-display text-xs"
                style={{
                  background: theme.tint,
                  color: theme.deep,
                  boxShadow: `0 0 0 2px ${theme.accent}`,
                  marginLeft: j === 0 ? 0 : -9,
                  zIndex: 10 - j,
                }}
              >
                {initialsOf(s.name)}
              </span>
            ))}
            {onNow.length > 4 && (
              <span
                className="relative -ml-[9px] flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold text-cream"
                style={{ boxShadow: `0 0 0 2px ${theme.accent}` }}
              >
                +{onNow.length - 4}
              </span>
            )}
          </div>
          <div className="leading-tight">
            <div className="font-display text-[22px] text-cream">{onNow.length}</div>
            <div className="text-[10px] uppercase tracking-[.1em]" style={{ color: theme.soft }}>
              on now
            </div>
          </div>
        </div>
      </div>
    </Cell>
  );
}

// ---------------------------------------------------------------------------
// Row 2 (Full day) — yesterday's wrap-up band + "write today's" entry point
// ---------------------------------------------------------------------------
export function WrapCard({
  pos,
  theme,
  wrap,
  today,
  isToday,
  closeMin,
  nowMin,
  yesterdayLabel,
  onSave,
}: {
  pos: CellPos;
  theme: BriefingVenueTheme;
  wrap: WrapUp | null;
  today: WrapDraft | null;
  isToday: boolean;
  closeMin: number | null;
  nowMin: number;
  yesterdayLabel: string;
  onSave: (headline: string, body: string, draft: boolean) => Promise<WrapDraft>;
}) {
  const [open, setOpen] = useState(true);
  const [writing, setWriting] = useState(false);
  const [headline, setHeadline] = useState(today?.headline ?? "");
  const [body, setBody] = useState(today?.body ?? "");
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const [error, setError] = useState("");
  // Local mirror of today's wrap so a save reflects immediately and survives
  // without a full page refetch; the server is the source of truth on reload.
  const [state, setState] = useState<WrapDraft | null>(today);

  const beginEdit = () => {
    setHeadline(state?.headline ?? "");
    setBody(state?.body ?? "");
    setError("");
    setWriting(true);
  };

  const save = async (draft: boolean, hl = headline, bd = body) => {
    if (!bd.trim() || busy) return;
    setBusy(draft ? "draft" : "publish");
    setError("");
    try {
      const saved = await onSave(hl, bd, draft);
      setState(saved);
      setWriting(false);
    } catch {
      setError("Couldn't save — check the connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  // An hour before close, nudge for the wrap-up until it's published.
  const remindDue =
    isToday && closeMin != null && nowMin >= closeMin - 60 && nowMin < closeMin && !(state && !state.draft);

  return (
    <Cell pos={pos}>
      <div className="overflow-hidden rounded-[10px] shadow-sm" style={{ background: theme.accent }}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-start gap-3 px-[18px] py-[15px] text-left"
        >
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-white/15 text-cream">
            {ic(ICONS.rewind, 16)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: theme.soft }}>
              Yesterday · {yesterdayLabel}
            </div>
            <div className="mt-0.5 font-display text-lg leading-tight text-cream">
              {wrap ? wrap.headline : "No wrap-up was written."}
            </div>
          </div>
          <span className="mt-0.5 flex shrink-0" style={{ color: theme.soft }}>
            {ic(open ? ICONS.chevU : ICONS.chevD, 18)}
          </span>
        </button>
        {open && (
          <div className="px-[18px] pb-[18px] sm:pl-[46px]">
            {wrap && <p className="mb-3.5 font-display text-[15px] leading-[1.55] text-white/90">{wrap.body}</p>}

            {/* Today's wrap-up entry — only on today's briefing */}
            {isToday && (
              <div className="mt-1 rounded-lg border border-white/20 bg-white/10 p-3">
                {remindDue && !writing && (
                  <div className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold text-cream">
                    {ic(ICONS.clock, 15)}
                    An hour to close — {state?.draft ? "publish today's wrap-up" : "don't forget today's wrap-up"}.
                  </div>
                )}
                {writing ? (
                  <div className="flex flex-col gap-2">
                    <input
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="One-line headline (optional)"
                      className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-[13.5px] text-cream placeholder:text-white/50"
                    />
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={4}
                      placeholder="How did today go? Anything the morning team should know?"
                      className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-[13.5px] leading-relaxed text-cream placeholder:text-white/50"
                    />
                    {error && <div className="text-[12px] font-semibold text-[#FFD9D2]">{error}</div>}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => save(false)}
                        disabled={!!busy || !body.trim()}
                        className="rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold disabled:opacity-50"
                        style={{ color: theme.deep }}
                      >
                        {busy === "publish" ? "Publishing…" : "Publish"}
                      </button>
                      <button
                        onClick={() => save(true)}
                        disabled={!!busy || !body.trim()}
                        className="rounded-full border-[1.5px] border-white/60 px-4 py-2 text-[12.5px] font-semibold text-cream disabled:opacity-50"
                      >
                        {busy === "draft" ? "Saving…" : "Save draft"}
                      </button>
                      <button
                        onClick={() => setWriting(false)}
                        className="rounded-full px-3 py-2 text-[12.5px] font-semibold text-cream/80 hover:text-cream"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : state && !state.draft ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-cream">
                      {ic(ICONS.check, 14)} Published — opens tomorrow&apos;s briefing
                    </span>
                    <span className="text-[11.5px]" style={{ color: theme.soft }}>
                      {state.byline} · {state.postedAt}
                    </span>
                    <button
                      onClick={beginEdit}
                      className="ml-auto rounded-full border border-white/40 px-3 py-1.5 text-[12px] font-semibold text-cream hover:border-white"
                    >
                      Edit
                    </button>
                  </div>
                ) : state && state.draft ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-semibold text-cream">Draft saved · {state.postedAt}</span>
                    <span className="text-[11.5px]" style={{ color: theme.soft }}>
                      not published yet
                    </span>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={beginEdit}
                        className="rounded-full border border-white/40 px-3 py-1.5 text-[12px] font-semibold text-cream hover:border-white"
                      >
                        Continue
                      </button>
                      <button
                        onClick={() => save(false, state.headline, state.body)}
                        disabled={!!busy}
                        className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50"
                        style={{ color: theme.deep }}
                      >
                        {busy === "publish" ? "Publishing…" : "Publish"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={beginEdit}
                    className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-white/50 px-3.5 py-2 text-[12.5px] font-semibold text-cream hover:border-white"
                  >
                    {ic(ICONS.edit, 15)}
                    Write today&apos;s wrap-up
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Cell>
  );
}

// ---------------------------------------------------------------------------
// Row 3 (Full day) — stat tiles
// ---------------------------------------------------------------------------
export function StatsRow({ pos, theme, data }: { pos: CellPos; theme: BriefingVenueTheme; data: VenueBriefing }) {
  return (
    <Cell pos={pos}>
      <div className="grid grid-cols-3 gap-2.5">
        {data.stats.map((st) => (
          <div key={st.label} className="rounded-lg border border-cream-2 bg-white px-3.5 py-3">
            <div className="font-display text-[22px] leading-none" style={{ color: theme.accent }}>
              {st.value}
            </div>
            <div className="mt-1 text-[11px] leading-tight text-stone">{st.label}</div>
          </div>
        ))}
      </div>
    </Cell>
  );
}

// ---------------------------------------------------------------------------
// Row 4 — on shift today
// ---------------------------------------------------------------------------
export function OnShift({
  pos,
  theme,
  data,
  nowMin,
  isToday,
  asOf,
}: {
  pos: CellPos;
  theme: BriefingVenueTheme;
  data: VenueBriefing;
  nowMin: number;
  isToday: boolean;
  asOf: string | null;
}) {
  return (
    <Cell pos={pos}>
      <SectionHead
        title="On shift today"
        right={<span className="text-[11px] text-stone">Deputy{asOf ? ` · as of ${asOf}` : " · sample data"}</span>}
      />
      <div className="mb-2 flex items-center gap-2.5 rounded-lg border border-cream-2 bg-white px-3.5 py-2.5">
        <span className="flex shrink-0" style={{ color: theme.accent }}>
          {ic(ICONS.clock, 17)}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[.14em] text-stone">Open today</span>
        <span className="text-sm font-semibold tabular-nums text-ink">{data.opening.hours}</span>
        {data.opening.note && (
          <span className="ml-auto text-right text-[11.5px] text-stone">{data.opening.note}</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {data.roster.length === 0 && (
          <div className="rounded-lg border border-dashed border-cream-2 p-[18px] text-center text-[13px] text-stone">
            No shifts on the roster.
          </div>
        )}
        {data.roster.map((p) => {
          const onNow = isToday && onShiftNow(p, nowMin);
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-cream-2 bg-white px-3.5 py-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-[15px]"
                style={{
                  background: theme.tint,
                  color: theme.deep,
                  boxShadow: `0 0 0 1.5px ${onNow ? theme.accent : "transparent"}`,
                }}
              >
                {initialsOf(p.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14.5px] font-semibold text-ink">{p.name}</span>
                  {onNow && (
                    <span
                      className="rounded-full px-[7px] py-0.5 text-[9.5px] font-bold uppercase tracking-[.08em] text-white"
                      style={{ background: theme.accent }}
                    >
                      On now
                    </span>
                  )}
                </div>
                <div className="text-[12.5px] text-stone">{p.role}</div>
              </div>
              <div className="whitespace-nowrap text-right text-[13px] font-semibold tabular-nums text-charcoal">
                {fmtMin(p.startMin)} – {fmtMin(p.endMin)}
              </div>
            </div>
          );
        })}
      </div>
    </Cell>
  );
}

// ---------------------------------------------------------------------------
// Row 5 — today's events
// ---------------------------------------------------------------------------
export function EventsList({ pos, theme, events }: { pos: CellPos; theme: BriefingVenueTheme; events: BriefingEvent[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <Cell pos={pos}>
      <SectionHead
        title="Today's events"
        right={<span className="text-[11px] text-stone">{events.length} on today</span>}
      />
      <div className="flex flex-col gap-2.5">
        {events.map((e) => {
          const isOpen = !!open[e.id];
          return (
            <div
              key={e.id}
              className="group overflow-hidden rounded-lg border border-cream-2 bg-white transition-shadow hover:shadow-md"
            >
              <button
                onClick={() => setOpen((o) => ({ ...o, [e.id]: !o[e.id] }))}
                className="flex w-full items-stretch text-left"
              >
                <div className="w-[5px] shrink-0" style={{ background: theme.accent }} />
                <div className="flex flex-1 items-center gap-3.5 px-4 py-3.5">
                  <div className="min-w-[52px] shrink-0 text-center">
                    <div className="font-display text-[19px] leading-none text-ink">{e.time}</div>
                    <div className="mt-0.5 text-[10px] text-stone">{e.ampm}</div>
                  </div>
                  <div className="w-px self-stretch bg-cream-2" />
                  <div className="min-w-0 flex-1">
                    <span
                      className="inline-block rounded-full px-2.5 py-[3px] text-[9.5px] font-bold uppercase tracking-[.1em]"
                      style={{ color: theme.deep, background: theme.tint }}
                    >
                      {e.type}
                    </span>
                    <div className="mt-1.5 text-[15px] font-semibold leading-tight text-ink group-hover:underline group-hover:decoration-2 group-hover:underline-offset-[3px]">
                      {e.title}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-stone">{e.meta}</div>
                  </div>
                  <span className="shrink-0 text-stone">{ic(isOpen ? ICONS.chevU : ICONS.chevR, 18)}</span>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-cream-2 px-4 pb-[15px] pt-0.5 sm:pl-[74px]">
                  <p className="mb-2.5 mt-3 text-[13px] leading-normal text-charcoal">{e.desc}</p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-stone">
                      On it: <span className="font-semibold text-charcoal">{e.staff}</span>
                    </span>
                    <Link
                      href={`/events/${e.id}`}
                      className="text-[12.5px] font-semibold hover:underline"
                      style={{ color: theme.accent }}
                    >
                      Open full event page
                      <span className="ml-1 inline-flex align-[-3px]">{ic(ICONS.arrow, 15)}</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="rounded-lg border border-dashed border-cream-2 p-[18px] text-center text-[13px] text-stone">
            Nothing on the calendar today.
          </div>
        )}
      </div>
    </Cell>
  );
}

// ---------------------------------------------------------------------------
// Row 6 — notes & tasks
// ---------------------------------------------------------------------------
export function TasksCard({
  pos,
  theme,
  data,
  onToggle,
}: {
  pos: CellPos;
  theme: BriefingVenueTheme;
  data: VenueBriefing;
  onToggle: (id: string, done: boolean) => void;
}) {
  const openCount = data.tasks.filter((t) => !t.done).length;
  return (
    <Cell pos={pos}>
      <SectionHead title="Notes & tasks" />
      <div className="overflow-hidden rounded-lg border border-cream-2 bg-white">
        {data.tasks.map((t) => (
          <button
            key={t.id}
            onClick={() => onToggle(t.id, !t.done)}
            className={`flex w-full items-start gap-3 border-b border-cream-2 px-4 py-[13px] text-left ${t.done ? "bg-cream" : "bg-white"}`}
          >
            <span
              className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] text-white"
              style={{
                borderColor: t.done ? theme.accent : "var(--color-cream-2)",
                background: t.done ? theme.accent : "#fff",
              }}
            >
              {t.done && ic(ICONS.check, 13)}
            </span>
            <div className="flex-1">
              <div
                className={`text-sm font-semibold leading-tight ${t.done ? "text-stone line-through" : "text-ink"}`}
              >
                {t.title}
              </div>
              {t.meta && <div className="mt-px text-[11.5px] text-stone">{t.meta}</div>}
            </div>
          </button>
        ))}
        {data.tasks.length === 0 && (
          <div className="p-[18px] text-center text-[13px] text-stone">Nothing on the list for today.</div>
        )}
        <div className="flex items-center justify-between bg-cream px-4 py-[11px]">
          <span className="text-xs text-stone">{openCount} open · from Deputy</span>
          <a
            href="https://once.deputy.com/my/tasks"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-rust hover:underline"
          >
            See all &amp; add →
          </a>
        </div>
      </div>
    </Cell>
  );
}

// ---------------------------------------------------------------------------
// Row 7 (Full day) — on-shift Slack chatter
// ---------------------------------------------------------------------------
export function ChatterCard({ pos, theme, data }: { pos: CellPos; theme: BriefingVenueTheme; data: VenueBriefing }) {
  return (
    <Cell pos={pos}>
      <SectionHead
        title="On-shift chatter"
        right={
          <span className="text-[11px] text-stone">
            Read-only ·{" "}
            <span className="font-semibold" style={{ color: theme.accent }}>
              {theme.channel}
            </span>
          </span>
        }
      />
      <div className="rounded-lg border border-cream-2 bg-white px-4 py-1.5">
        {data.slack.map((m) => (
          <div key={m.id} className="flex gap-3 border-b border-cream-2 py-[11px]">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold"
              style={{ background: theme.tint, color: theme.deep }}
            >
              {initialsOf(m.author)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-semibold text-ink">{m.author}</span>
                <span className="text-[11px] text-stone">{m.time}</span>
                {m.isNew && (
                  <span
                    className="rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-[.06em] text-white"
                    style={{ background: theme.accent }}
                  >
                    New
                  </span>
                )}
              </div>
              <div className="mt-px text-[13px] leading-snug text-charcoal">{m.text}</div>
            </div>
          </div>
        ))}
        {data.slack.length === 0 && (
          <div className="py-4 text-center text-[13px] text-stone">Nothing in {theme.channel} for this day.</div>
        )}
        <div className="pb-2.5 pt-[11px] text-center text-xs text-stone">Open in Slack to reply →</div>
      </div>
    </Cell>
  );
}
