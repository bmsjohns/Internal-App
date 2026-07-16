"use client";

import { useState } from "react";
import type { EventPhase, EventRole, ShowEvent } from "@/lib/types";
import { PHASES, phaseMeta } from "@/lib/events";
import { initialsOf } from "@/lib/config";
import { panelCls, panelHead } from "@/components/form";
import type { EventsMeta } from "./EventEditor";

/**
 * Staffing (design brief §2): the people/roles view — roles are defined PER
 * EVENT within each phase (spec §6.1; no fixed global role list), people
 * assigned per role. Complementary to the Running order's timeline, so the
 * two cross-link instead of repeating each other.
 */
export default function StaffingTab({
  draft,
  meta,
  onChange,
  goRunning,
}: {
  draft: ShowEvent;
  meta: EventsMeta;
  onChange: (roles: EventRole[]) => void;
  goRunning: () => void;
}) {
  const canEdit = meta.canEdit && meta.schemaReady;

  // roster by person, "you" first then most roles
  const byPerson = new Map<string, { id: string; name: string; roles: { phase: EventPhase; role: string }[] }>();
  for (const r of draft.roles)
    for (const s of r.staff) {
      if (!byPerson.has(s.id)) byPerson.set(s.id, { id: s.id, name: s.name, roles: [] });
      byPerson.get(s.id)!.roles.push({ phase: r.phase, role: r.name });
    }
  const roster = [...byPerson.values()].sort(
    (a, b) => (b.id === meta.me.id ? 1 : 0) - (a.id === meta.me.id ? 1 : 0) || b.roles.length - a.roles.length
  );
  const gaps = draft.roles.filter((r) => r.staff.length === 0);
  const host = meta.hosts.find((h) => h.id === draft.hostId);

  const updateRole = (id: string, patch: Partial<EventRole>) =>
    onChange(draft.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRole = (id: string) => onChange(draft.roles.filter((r) => r.id !== id));
  const addRole = (phase: EventPhase, name: string) =>
    onChange([
      ...draft.roles,
      { id: `role-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, phase, name: name.trim(), staff: [] },
    ]);

  return (
    <div className="flex max-w-[940px] flex-col gap-[18px]">
      {!meta.schemaReady && (
        <div className="rounded-lg border border-cream-2 bg-cream px-4 py-3 text-[12.5px] text-charcoal">
          Read-only for now — per-role staffing gets its own Airtable table in the Phase 2 migration
          (awaiting sign-off).
        </div>
      )}

      <div className="grid items-start gap-[18px] sm:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]">
        <div className={panelCls}>
          <span className={panelHead}>Who&rsquo;s on</span>
          <p className="m-0 text-[13.5px] leading-relaxed text-charcoal">
            {roster.length} {roster.length === 1 ? "person" : "people"} assigned across the three phases. This
            is the roster view — for the timed run of show, see{" "}
            <button onClick={goRunning} className="cursor-pointer p-0 text-[13.5px] font-semibold text-rust">
              Running order →
            </button>
          </p>
        </div>
        <div className={panelCls}>
          <span className={panelHead}>Host / chair</span>
          {host ? (
            <>
              <div className="mb-0.5 font-display text-base">{host.name}</div>
              <div className="mb-2.5 text-[12.5px] text-stone">{host.fee === 0 ? "No fee (in-house)" : host.fee != null ? `£${host.fee}` : "Fee TBC"}</div>
              {host.phone && (
                <a href={`tel:${host.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 rounded-full border border-blush px-3 py-1.5 text-[12.5px] font-semibold text-rust">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 2z" /></svg>
                  {host.phone}
                </a>
              )}
            </>
          ) : (
            <p className="m-0 text-[13px] text-stone">No host picked yet — choose one on the General tab.</p>
          )}
        </div>
      </div>

      {gaps.length > 0 && (
        <div className="rounded-[10px] border border-[#B0812F44] bg-[#B0812F14] px-4 py-3.5">
          <div className="mb-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-[#8a6420]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5v.5" /></svg>
            Roles still to fill
          </div>
          <div className="flex flex-wrap gap-[7px]">
            {gaps.map((g) => (
              <span key={g.id} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-cream-2 bg-white px-3 py-1.5 text-xs font-semibold text-charcoal">
                {phaseMeta(g.phase).label} · {g.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* role editor by phase — the per-event role list (spec §5.2/§6.1) */}
      <div className="grid items-start gap-3.5 lg:grid-cols-3">
        {PHASES.map((ph) => {
          const roles = draft.roles.filter((r) => r.phase === ph.key);
          return (
            <section key={ph.key} className="overflow-hidden rounded-[10px] border border-cream-2 bg-white">
              <div className="flex items-center gap-2.5 border-b border-cream-2 px-4 py-3">
                <span className="h-[10px] w-[10px] rounded-full" style={{ background: ph.color }} />
                <div className="leading-tight">
                  <div className="font-display text-[15px]">{ph.label}</div>
                  <div className="text-[11px] text-stone">{ph.hint}</div>
                </div>
              </div>
              <div className="flex flex-col">
                {roles.map((r) => (
                  <RoleRow
                    key={r.id}
                    role={r}
                    meta={meta}
                    canEdit={canEdit}
                    onChange={(patch) => updateRole(r.id, patch)}
                    onRemove={() => removeRole(r.id)}
                  />
                ))}
                {roles.length === 0 && <div className="px-4 py-3.5 text-[12.5px] text-stone">No roles for this phase yet.</div>}
                {canEdit && <AddRole onAdd={(name) => addRole(ph.key, name)} />}
              </div>
            </section>
          );
        })}
      </div>

      {/* roster cards */}
      {roster.length > 0 && (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
          {roster.map((p) => {
            const mine = p.id === meta.me.id;
            const staffRole = meta.staff.find((s) => s.id === p.id)?.staffRole ?? "";
            return (
              <div
                key={p.id}
                className={`flex flex-col gap-2.5 rounded-[10px] border bg-white px-4 py-[15px] ${mine ? "border-rust shadow-[0_0_0_1px_var(--color-rust)]" : "border-cream-2"}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-sm ${mine ? "bg-rust text-cream" : "bg-shell text-rust"}`}>
                    {initialsOf(p.name)}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[14.5px] font-semibold">{p.name}</span>
                      {mine && <span className="rounded-full bg-rust px-[7px] py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-cream">You</span>}
                    </div>
                    {staffRole && <div className="text-xs text-stone">{staffRole}</div>}
                  </div>
                </div>
                <div className="flex flex-col items-start gap-1.5">
                  {p.roles.map((r, i) => {
                    const m = phaseMeta(r.phase);
                    return (
                      <span key={i} className="inline-flex items-center rounded-full border px-2.5 py-[3px] text-xs" style={{ color: m.color, background: `${m.color}14`, borderColor: `${m.color}33` }}>
                        {m.label} · {r.role}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RoleRow({
  role,
  meta,
  canEdit,
  onChange,
  onRemove,
}: {
  role: EventRole;
  meta: EventsMeta;
  canEdit: boolean;
  onChange: (patch: Partial<EventRole>) => void;
  onRemove: () => void;
}) {
  const unassigned = meta.staff.filter((s) => !role.staff.some((x) => x.id === s.id));
  return (
    <div className="border-b border-cream-2 px-4 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13.5px] font-semibold">{role.name}</span>
        {canEdit && (
          <button onClick={onRemove} aria-label={`Remove role ${role.name}`} className="cursor-pointer rounded p-1 text-stone hover:bg-ink/5 hover:text-rust">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {role.staff.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-shell py-1 pl-1 pr-2 text-xs font-semibold text-rust">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rust text-[9px] text-cream">{initialsOf(s.name)}</span>
            {s.name}
            {canEdit && (
              <button
                onClick={() => onChange({ staff: role.staff.filter((x) => x.id !== s.id) })}
                aria-label={`Remove ${s.name} from ${role.name}`}
                className="ml-0.5 cursor-pointer opacity-60 hover:opacity-100"
              >
                ×
              </button>
            )}
          </span>
        ))}
        {role.staff.length === 0 && !canEdit && <span className="text-xs text-stone">Unassigned</span>}
        {canEdit && unassigned.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const s = meta.staff.find((x) => x.id === e.target.value);
              if (s) onChange({ staff: [...role.staff, { id: s.id, name: s.name }] });
            }}
            aria-label={`Assign someone to ${role.name}`}
            className="cursor-pointer rounded-full border border-dashed border-cream-2 bg-white px-2 py-1 text-xs font-semibold text-stone"
          >
            <option value="">+ Assign</option>
            {unassigned.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

function AddRole({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  const submit = () => {
    if (name.trim()) {
      onAdd(name);
      setName("");
    }
  };
  return (
    <div className="flex items-center gap-2 border-t border-dashed border-cream-2 px-4 py-2.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="+ Add a role for this event…"
        className="min-w-0 flex-1 bg-transparent py-1 text-[13px] outline-none placeholder:text-stone"
      />
      {name.trim() && (
        <button onClick={submit} className="cursor-pointer rounded border border-rust px-2.5 py-1 text-xs font-semibold text-rust">
          Add
        </button>
      )}
    </div>
  );
}
