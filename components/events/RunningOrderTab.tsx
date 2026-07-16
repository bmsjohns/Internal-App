"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventPhase, ScheduleItem, ShowEvent } from "@/lib/types";
import { PHASES, fmtEventTime, liveState, sortSchedule } from "@/lib/events";
import { initialsOf } from "@/lib/config";
import { Chevron, inputCls, labelCls, selectCls, selectWrap } from "@/components/form";
import type { EventsMeta } from "./EventEditor";

/**
 * Running order (design brief §3): a time-sequenced plan of the show by
 * phase — glanceable rows when reading (and live), inline editing when
 * planning. The same tab serves both without switching screens.
 */
export default function RunningOrderTab({
  draft,
  meta,
  onChange,
  goStaffing,
}: {
  draft: ShowEvent;
  meta: EventsMeta;
  onChange: (schedule: ScheduleItem[]) => void;
  goStaffing: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingPhase, setAddingPhase] = useState<EventPhase | null>(null);

  // Re-evaluate the live markers every 30s so "Now" moves without a reload.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const sorted = useMemo(() => sortSchedule(draft.schedule), [draft.schedule]);
  const live = liveState(draft);
  const nowItem = live.nowIndex >= 0 ? sorted[live.nowIndex] : null;
  const nextItem = live.nextIndex >= 0 ? sorted[live.nextIndex] : null;
  const currentPhase = nowItem?.phase ?? null;

  const leadName = (leadId: string | null): string | null => {
    if (!leadId) return null;
    if (leadId === "host") return draft.hostName || "Host / chair";
    return meta.staff.find((s) => s.id === leadId)?.name ?? null;
  };
  const leadRole = (leadId: string | null): string =>
    leadId === "host" ? "Host / chair" : meta.staff.find((s) => s.id === leadId)?.staffRole ?? "";

  const canEdit = meta.canEdit && meta.schemaReady;

  const upsert = (item: ScheduleItem) => {
    const exists = draft.schedule.some((s) => s.id === item.id);
    onChange(exists ? draft.schedule.map((s) => (s.id === item.id ? item : s)) : [...draft.schedule, item]);
    setEditingId(null);
    setAddingPhase(null);
  };
  const removeStep = (id: string) => {
    onChange(draft.schedule.filter((s) => s.id !== id));
    setEditingId(null);
  };

  return (
    <div className="flex max-w-[940px] flex-col gap-4">
      {!meta.schemaReady && (
        <div className="rounded-lg border border-cream-2 bg-cream px-4 py-3 text-[12.5px] text-charcoal">
          Read-only for now — the run of show gets its own Airtable tables in the Phase 2 migration
          (awaiting sign-off). Nothing you see here can be edited until that lands.
        </div>
      )}

      {/* live banner */}
      {live.isLive && nowItem && (
        <div className="flex flex-wrap items-center gap-5 rounded-xl bg-rust px-5 py-4 text-cream">
          <div className="flex items-center gap-2">
            <span className="ob-pulse h-[9px] w-[9px] rounded-full bg-cream" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Live now</span>
          </div>
          <div className="min-w-[180px] flex-1 leading-tight">
            <div className="text-[10.5px] uppercase tracking-[0.12em] opacity-85">
              {PHASES.find((p) => p.key === nowItem.phase)?.label} · {fmtEventTime(nowItem.time)}
            </div>
            <div className="font-display text-xl">{nowItem.title}</div>
          </div>
          {nextItem && (
            <div className="border-l border-white/30 pl-4 leading-tight">
              <div className="text-[10.5px] uppercase tracking-[0.12em] opacity-85">Up next · {fmtEventTime(nextItem.time)}</div>
              <div className="text-[15px] font-semibold">{nextItem.title}</div>
            </div>
          )}
        </div>
      )}

      {sorted.length === 0 && !addingPhase ? (
        <div className="rounded-xl border border-dashed border-cream-2 bg-white px-6 py-12 text-center">
          <div className="mb-3.5 inline-flex h-[52px] w-[52px] items-center justify-center rounded-full bg-shell text-rust">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          </div>
          <div className="mb-1.5 font-display text-xl">Nothing scheduled yet</div>
          <p className="mx-auto mb-[18px] max-w-[380px] text-[13.5px] leading-relaxed text-stone">
            Build the run of show — set-up and doors, the main event, then signing and pack-down. Assign who
            leads each step.
          </p>
          {canEdit && (
            <button
              onClick={() => setAddingPhase("pre")}
              className="cursor-pointer rounded border-[1.5px] border-rust bg-rust px-5 py-2.5 text-[13px] font-semibold text-cream"
            >
              + Add the first step
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {PHASES.map((ph) => {
            const items = sorted.filter((s) => s.phase === ph.key);
            const isCurrent = currentPhase === ph.key;
            const phasePeople = new Map<string, string>();
            for (const r of draft.roles) if (r.phase === ph.key) for (const s of r.staff) phasePeople.set(s.id, s.name);
            const window =
              items.length === 0
                ? ""
                : items.length === 1
                  ? fmtEventTime(items[0].time)
                  : `${fmtEventTime(items[0].time)}–${fmtEventTime(items[items.length - 1].time)}`;
            return (
              <section key={ph.key} className="overflow-hidden rounded-[10px] border border-cream-2 bg-white">
                <div
                  className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-[18px]"
                  style={isCurrent ? { background: `${ph.color}14` } : undefined}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ background: ph.color }} />
                    <div className="leading-tight">
                      <div className="font-display text-[17px]">{ph.label}</div>
                      <div className="text-xs text-stone">{ph.hint}</div>
                    </div>
                    {window && <span className="ml-1.5 whitespace-nowrap text-[12.5px] font-semibold tabular-nums text-charcoal">{window}</span>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {isCurrent && (
                      <span className="rounded-full border border-rust bg-white px-2.5 py-[3px] text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
                        Now
                      </span>
                    )}
                    <div className="hidden pl-1.5 sm:flex">
                      {[...phasePeople.entries()].slice(0, 6).map(([id, name]) => (
                        <span
                          key={id}
                          title={name}
                          className="-ml-1.5 inline-flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-white bg-rust text-[10px] text-cream"
                        >
                          {initialsOf(name)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {items.map((it) => {
                  const gi = sorted.indexOf(it);
                  const state = !live.isLive ? "plan" : gi === live.nowIndex ? "now" : gi === live.nextIndex ? "next" : gi < live.nowIndex ? "past" : "up";
                  const accent = state === "now" || state === "next" ? ph.color : "var(--color-cream-2)";
                  const name = leadName(it.leadId);
                  const mine = it.leadId === meta.me.id;
                  if (editingId === it.id) {
                    return (
                      <StepForm
                        key={it.id}
                        initial={it}
                        phase={ph.key}
                        meta={meta}
                        onSave={upsert}
                        onCancel={() => setEditingId(null)}
                        onDelete={() => removeStep(it.id)}
                      />
                    );
                  }
                  return (
                    <div
                      key={it.id}
                      className="flex items-start gap-3.5 border-t border-cream-2 py-3 pl-3.5 pr-4"
                      style={{
                        borderLeft: `3px solid ${accent}`,
                        background: state === "now" ? `${ph.color}12` : state === "next" ? "var(--color-cream)" : "#fff",
                        opacity: state === "past" ? 0.55 : 1,
                      }}
                    >
                      <div className="w-[56px] shrink-0 pt-px font-display text-base tabular-nums" style={{ color: state === "now" ? ph.color : state === "past" ? "var(--color-stone)" : "var(--color-ink)" }}>
                        {fmtEventTime(it.time)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14.5px] font-semibold">{it.title}</span>
                          {state === "now" && (
                            <span className="rounded-full bg-rust px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cream">Now</span>
                          )}
                          {state === "next" && (
                            <span className="rounded-full border border-rust px-[7px] py-px text-[10px] font-bold uppercase tracking-wider text-rust">Up next</span>
                          )}
                        </div>
                        {it.note && <div className="mt-0.5 text-[12.5px] leading-snug text-stone">{it.note}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 pt-px">
                        {name ? (
                          <span
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-1 pr-3 text-[12.5px] font-semibold ${
                              mine ? "bg-rust text-cream" : "border border-cream-2 bg-cream text-ink"
                            }`}
                          >
                            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${mine ? "bg-cream font-bold text-rust" : "bg-rust text-cream"}`}>
                              {initialsOf(name)}
                            </span>
                            <span className="hidden leading-tight sm:inline-flex sm:flex-col">
                              <span>{name}</span>
                              <span className="text-[10.5px] font-medium opacity-70">{leadRole(it.leadId)}</span>
                            </span>
                          </span>
                        ) : (
                          <span className="rounded-full border border-dashed border-cream-2 px-3 py-1.5 text-xs font-semibold text-stone">
                            Unassigned
                          </span>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => { setEditingId(it.id); setAddingPhase(null); }}
                            aria-label={`Edit ${it.title}`}
                            className="cursor-pointer rounded p-1.5 text-stone hover:bg-ink/5 hover:text-ink"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {items.length === 0 && addingPhase !== ph.key && (
                  <div className="border-t border-cream-2 px-4 py-4 text-center text-[13px] text-stone">
                    No steps in this phase yet
                    {canEdit && (
                      <>
                        {" — "}
                        <button onClick={() => { setAddingPhase(ph.key); setEditingId(null); }} className="cursor-pointer font-semibold text-rust">
                          add the first
                        </button>
                      </>
                    )}
                  </div>
                )}
                {addingPhase === ph.key && (
                  <StepForm phase={ph.key} meta={meta} onSave={upsert} onCancel={() => setAddingPhase(null)} />
                )}
                {items.length > 0 && canEdit && addingPhase !== ph.key && (
                  <button
                    onClick={() => { setAddingPhase(ph.key); setEditingId(null); }}
                    className="w-full cursor-pointer border-t border-dashed border-cream-2 bg-white px-4 py-3 text-left text-[12.5px] font-semibold text-rust"
                  >
                    + Add a step
                  </button>
                )}
              </section>
            );
          })}

          <button
            onClick={goStaffing}
            className="flex cursor-pointer items-center justify-between gap-2.5 rounded-[10px] border border-cream-2 bg-white px-4 py-4 text-left hover:bg-shell/50"
          >
            <span className="flex items-center gap-2.5">
              <span className="text-rust">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.7c3 .3 5.5 2.3 5.5 5.3" /></svg>
              </span>
              <span className="text-[13.5px] font-semibold text-ink">See who&rsquo;s on by person — the full roster</span>
            </span>
            <span className="whitespace-nowrap text-[13px] font-semibold text-rust">Staffing →</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** Inline add/edit form for one step — the planning half of the tab. */
function StepForm({
  initial,
  phase,
  meta,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: ScheduleItem;
  phase: EventPhase;
  meta: EventsMeta;
  onSave: (item: ScheduleItem) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [time, setTime] = useState(initial?.time ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [leadId, setLeadId] = useState(initial?.leadId ?? "");

  const valid = /^\d{2}:\d{2}$/.test(time) && title.trim().length > 0;
  const save = () =>
    valid &&
    onSave({
      id: initial?.id ?? `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time,
      phase,
      title: title.trim(),
      note: note.trim(),
      leadId: leadId || null,
    });

  return (
    <div className="border-t border-cream-2 bg-cream px-4 py-3.5">
      <div className="grid gap-2.5 sm:grid-cols-[110px_1fr_1fr]">
        <div>
          <label className={labelCls}>Time</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>What happens</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className={inputCls}
            placeholder="e.g. Doors open · box office"
            autoFocus
          />
        </div>
        <div>
          <label className={labelCls}>Lead</label>
          <div className={selectWrap}>
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className={selectCls}>
              <option value="">Unassigned</option>
              <option value="host">Host / chair</option>
              {meta.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Chevron />
          </div>
        </div>
      </div>
      <div className="mt-2.5">
        <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} className={inputCls} placeholder="Note for the team (optional)" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={save} disabled={!valid} className="cursor-pointer rounded border-[1.5px] border-rust bg-rust px-3.5 py-2 text-xs font-semibold text-cream disabled:opacity-50">
          {initial ? "Save step" : "Add step"}
        </button>
        <button onClick={onCancel} className="cursor-pointer rounded border-[1.5px] border-cream-2 bg-white px-3.5 py-2 text-xs font-semibold text-charcoal">
          Cancel
        </button>
        {onDelete && (
          <button onClick={onDelete} className="ml-auto cursor-pointer rounded px-2.5 py-2 text-xs font-semibold text-rust hover:bg-shell">
            Remove step
          </button>
        )}
      </div>
    </div>
  );
}
