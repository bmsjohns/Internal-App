"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Location } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";
import {
  groupedPermissions,
  roleById,
  type PermissionKey,
  type PermissionOverride,
  type RoleDefinition,
  type RoleId,
} from "@/lib/permissions";
import type { TeamMember } from "@/lib/team-directory";

type Tab = "people" | "roles";
const groups = groupedPermissions();

const icon = (path: string, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: path }} />
);

const icons = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.2 2.9-5.3 6.5-5.3s6.5 2.1 6.5 5.3M16 5.2a3.5 3.5 0 0 1 0 6.8M17.5 15c2.4.7 4 2.4 4 5"/>',
  roles: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 9h8M8 13h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatLastActive(value: string | null) {
  if (!value) return "Invite pending";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 86_400_000) return "Active today";
  if (diff < 172_800_000) return "Active yesterday";
  return `Active ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

function LocationPills({ locations }: { locations: Location[] }) {
  if (locations.length === 2) return <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-charcoal">Both locations</span>;
  return <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-charcoal">{locations[0]}</span>;
}

function AccessDot({ overridden }: { overridden: boolean }) {
  return overridden ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff4de] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a5a13]">
      <span className="h-1.5 w-1.5 rounded-full bg-ochre" /> Overridden
    </span>
  ) : null;
}

export default function TeamPermissionsClient({ initialMembers, initialRoles, currentUserId }: {
  initialMembers: TeamMember[];
  initialRoles: RoleDefinition[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("people");
  const [members, setMembers] = useState(initialMembers);
  const [roles, setRoles] = useState(initialRoles);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => members.filter((member) =>
    `${member.name} ${member.email} ${roleById(roles, member.role).name}`.toLowerCase().includes(query.toLowerCase())
  ), [members, query, roles]);
  const selected = members.find((member) => member.id === selectedId) ?? null;

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

  return (
    <div className="min-h-screen bg-cream">
      <div className="border-b border-cream-2 bg-white px-5 sm:px-8">
        <div className="mx-auto flex max-w-[1240px] items-end justify-between gap-6 pt-8">
          <div>
            <div className="eyebrow text-rust">Administration</div>
            <h1 className="mt-1 text-[34px] leading-tight text-ink">Team &amp; Permissions</h1>
            <p className="mt-2 max-w-[620px] text-sm text-charcoal">Control who can do what, and where. Changes apply immediately.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-cream-2 bg-cream p-1 sm:flex">
            {(["people", "roles"] as Tab[]).map((value) => (
              <button key={value} onClick={() => { setTab(value); setSelectedId(null); }} className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition ${tab === value ? "bg-white text-ink shadow-sm" : "text-stone hover:text-ink"}`}>
                {icon(value === "people" ? icons.people : icons.roles, 16)} {value === "people" ? "People" : "Roles"}
              </button>
            ))}
          </div>
        </div>
        <div className="mx-auto mt-7 flex max-w-[1240px] gap-6 sm:hidden">
          {(["people", "roles"] as Tab[]).map((value) => <button key={value} onClick={() => setTab(value)} className={`border-b-2 px-2 pb-3 text-sm font-semibold ${tab === value ? "border-rust text-rust" : "border-transparent text-stone"}`}>{value === "people" ? "People" : "Roles"}</button>)}
        </div>
      </div>

      {tab === "people" ? (
        selected ? (
          <MemberDetail member={selected} roles={roles} currentUserId={currentUserId} onBack={() => setSelectedId(null)} onSaved={(member) => { setMembers((all) => all.map((item) => item.id === member.id ? member : item)); notify("Access updated — effective immediately"); router.refresh(); }} onStatus={(active) => { setMembers((all) => all.map((item) => item.id === selected.id ? { ...item, active } : item)); notify(active ? "Account reactivated" : "Account deactivated"); setSelectedId(null); }} />
        ) : (
          <div className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full max-w-[390px]">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone">{icon(icons.search, 17)}</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people, email or role…" aria-label="Search people, email or role" className="w-full rounded-lg border border-cream-2 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-rust" />
              </div>
              <button onClick={() => setInviteOpen(true)} className="flex items-center justify-center gap-2 rounded-lg bg-rust px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rust-deep">{icon(icons.plus, 16)} Invite person</button>
            </div>
            <div className="overflow-hidden rounded-xl border border-cream-2 bg-white shadow-[0_1px_2px_rgba(26,23,20,.03)]">
              <div className="hidden grid-cols-[minmax(230px,1.4fr)_160px_140px_120px_118px] gap-4 border-b border-cream-2 bg-[#faf9f7] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone md:grid">
                <span>Person</span><span>Role</span><span>Access</span><span>Last active</span><span />
              </div>
              {filtered.map((member) => (
                <button key={member.id} onClick={() => setSelectedId(member.id)} className={`grid w-full grid-cols-[1fr_auto] items-center gap-4 border-b border-cream-2 px-4 py-4 text-left transition last:border-0 hover:bg-[#fcfbf9] md:grid-cols-[minmax(230px,1.4fr)_160px_140px_120px_118px] md:px-5 ${!member.active ? "opacity-55" : ""}`}>
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm ${member.role === "admin" ? "bg-rust text-white" : "bg-shell text-rust"}`}>{initials(member.name)}</span>
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{member.name}{member.id === currentUserId && <span className="ml-2 font-normal text-stone">You</span>}</span><span className="block truncate text-xs text-stone">{member.email}</span></span>
                  </span>
                  <span className="hidden text-[13px] font-semibold text-charcoal md:block">{roleById(roles, member.role).name}</span>
                  <span className="hidden md:block"><LocationPills locations={member.locations} /></span>
                  <span className="hidden text-xs text-stone md:block">{member.active ? formatLastActive(member.lastActiveAt) : "Deactivated"}</span>
                  <span className="flex items-center justify-end gap-2 text-stone"><AccessDot overridden={member.overrides.length > 0} />{icon(icons.chevron, 16)}</span>
                  <span className="col-span-2 ml-[52px] flex items-center gap-2 md:hidden"><span className="text-xs font-semibold text-charcoal">{roleById(roles, member.role).name}</span><LocationPills locations={member.locations} /></span>
                </button>
              ))}
              {!filtered.length && <div className="px-6 py-16 text-center text-sm text-stone">No people match “{query}”.</div>}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-stone">Deactivating a person removes access but preserves their name in order and event audit history.</p>
          </div>
        )
      ) : <RoleManager roles={roles} setRoles={setRoles} notify={notify} />}

      {inviteOpen && <InviteDialog roles={roles} onClose={() => setInviteOpen(false)} onInvited={() => { setInviteOpen(false); notify("Invitation sent"); window.location.reload(); }} />}
      {toast && <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-xl">{icon(icons.check, 15)} {toast}</div>}
    </div>
  );
}

function MemberDetail({ member, roles, currentUserId, onBack, onSaved, onStatus }: {
  member: TeamMember; roles: RoleDefinition[]; currentUserId: string;
  onBack: () => void; onSaved: (member: TeamMember) => void; onStatus: (active: boolean) => void;
}) {
  const [draft, setDraft] = useState(member);
  const [expanded, setExpanded] = useState<string[]>(["Customer Orders"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const own = member.id === currentUserId;
  const role = roleById(roles, draft.role);
  const dirty = JSON.stringify(draft) !== JSON.stringify(member);

  const overrideFor = (permission: PermissionKey, location: Location) => draft.overrides.find((item) => item.permission === permission && item.location === location);
  const effective = (permission: PermissionKey, location: Location) => {
    if (!draft.locations.includes(location)) return false;
    const override = overrideFor(permission, location);
    return override ? override.effect === "grant" : role.permissions.includes(permission);
  };
  const cycle = (permission: PermissionKey, location: Location) => {
    const existing = overrideFor(permission, location);
    const roleDefault = role.permissions.includes(permission);
    let next: PermissionOverride | null;
    if (!existing) next = { permission, location, effect: roleDefault ? "revoke" : "grant" };
    else if ((existing.effect === "revoke" && roleDefault) || (existing.effect === "grant" && !roleDefault)) next = null;
    else next = { permission, location, effect: existing.effect === "grant" ? "revoke" : "grant" };
    setDraft((current) => ({ ...current, overrides: [...current.overrides.filter((item) => !(item.permission === permission && item.location === location)), ...(next ? [next] : [])] }));
  };
  const save = async () => {
    setSaving(true); setError("");
    const response = await fetch(`/api/team/${member.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: draft.role, locations: draft.locations, overrides: draft.overrides }) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) return setError(data.error ?? "Could not save access");
    onSaved(data.member);
  };
  const status = async () => {
    if (!member.active && !(await confirmAction(`Reactivate ${member.name}?`, "Reactivate account"))) return;
    if (member.active && !(await confirmAction(`Deactivate ${member.name}? They will immediately lose access, but their history will be kept.`, "Deactivate account"))) return;
    const response = await fetch(`/api/team/${member.id}`, { method: member.active ? "DELETE" : "POST" });
    const data = await response.json();
    if (!response.ok) return setError(data.error ?? "Could not update account");
    onStatus(!member.active);
  };

  return (
    <div className="mx-auto max-w-[1120px] px-5 py-7 sm:px-8">
      <button onClick={onBack} className="mb-5 flex items-center gap-2 text-sm font-semibold text-charcoal hover:text-rust">{icon(icons.back, 17)} Back to team</button>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="h-fit overflow-hidden rounded-xl border border-cream-2 bg-white">
          <div className="border-b border-cream-2 p-6 text-center">
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full font-display text-xl ${draft.role === "admin" ? "bg-rust text-white" : "bg-shell text-rust"}`}>{initials(member.name)}</div>
            <h2 className="mt-3 text-[23px]">{member.name}</h2><p className="mt-0.5 text-xs text-stone">{member.email}</p>
            <div className="mt-3 flex justify-center"><AccessDot overridden={draft.overrides.length > 0} /></div>
          </div>
          <div className="space-y-5 p-5">
            <label className="block"><span className="eyebrow text-stone">Base role</span><select disabled={own} value={draft.role} onChange={(event) => { const next = event.target.value as RoleId; setDraft((current) => ({ ...current, role: next, locations: next === "admin" ? [...LOCATIONS] : current.locations, overrides: [] })); }} className="mt-2 w-full rounded-lg border border-cream-2 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-rust disabled:bg-cream disabled:text-stone">{roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <div><div className="eyebrow text-stone">Locations</div><div className="mt-2 space-y-2">{LOCATIONS.map((location) => <label key={location} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${draft.locations.includes(location) ? "border-rust/30 bg-shell/35" : "border-cream-2"}`}><input disabled={own || draft.role === "admin"} type="checkbox" checked={draft.locations.includes(location)} onChange={(event) => setDraft((current) => ({ ...current, locations: event.target.checked ? [...current.locations, location] : current.locations.filter((item) => item !== location), overrides: current.overrides.filter((item) => item.location !== location || event.target.checked) }))} className="accent-rust" /><span className="font-semibold">{location}</span></label>)}</div></div>
            <div className="rounded-lg bg-cream p-3 text-xs leading-relaxed text-charcoal"><span className="font-semibold">Role default:</span> {role.description}</div>
            {own && <p className="text-xs leading-relaxed text-stone">For safety, Admins cannot change their own access. Ask another Admin.</p>}
          </div>
        </aside>
        <section className="overflow-hidden rounded-xl border border-cream-2 bg-white">
          <div className="flex flex-col gap-3 border-b border-cream-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-xl">Permission overrides</h2><p className="mt-0.5 text-xs text-stone">Click a location control to differ from the {role.name} default.</p></div>
            <div className="flex gap-2 text-[10px] font-semibold uppercase tracking-[0.08em]"><span className="rounded-full bg-[#edf5ea] px-2.5 py-1 text-moss">Granted</span><span className="rounded-full bg-shell px-2.5 py-1 text-rust">Revoked</span></div>
          </div>
          {groups.map((group) => {
            const open = expanded.includes(group.module);
            const count = group.permissions.reduce((total, permission) => total + LOCATIONS.filter((location) => effective(permission.key, location)).length, 0);
            return <div key={group.module} className="border-b border-cream-2 last:border-0"><button onClick={() => setExpanded((items) => open ? items.filter((item) => item !== group.module) : [...items, group.module])} className="flex w-full items-center gap-3 bg-[#fcfbf9] px-5 py-3.5 text-left"><span className={`transition ${open ? "rotate-90" : ""}`}>{icon(icons.chevron, 15)}</span><span className="flex-1 text-[13px] font-semibold">{group.module}</span><span className="text-xs text-stone">{count} of {group.permissions.length * 2}</span></button>{open && <div>{group.permissions.map((permission) => <div key={permission.key} className="grid grid-cols-[1fr_94px_94px] items-center gap-2 border-t border-cream-2 px-5 py-3.5"><div className="pr-3"><div className="text-[13px] font-semibold text-ink">{permission.label}{("sensitive" in permission && permission.sensitive) && <span className="ml-2 text-rust">• sensitive</span>}</div><div className="mt-0.5 text-[11px] leading-snug text-stone">{permission.description}</div></div>{LOCATIONS.map((location) => { const override = overrideFor(permission.key, location); const allowed = effective(permission.key, location); const disabled = own || !draft.locations.includes(location) || draft.role === "admin"; return <button key={location} disabled={disabled} onClick={() => cycle(permission.key, location)} title={`${location}: ${override ? `explicitly ${override.effect === "grant" ? "granted" : "revoked"}` : "role default"}`} className={`rounded-md border px-2 py-2 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-30 ${override?.effect === "grant" ? "border-moss/25 bg-[#edf5ea] text-moss" : override?.effect === "revoke" ? "border-rust/20 bg-shell text-rust" : allowed ? "border-cream-2 bg-white text-charcoal" : "border-cream-2 bg-cream text-stone"}`}><span className="block truncate">{location === "Simply Books" ? "Simply" : "Prologue"}</span><span className="mt-0.5 block text-[9px] font-normal">{override ? override.effect === "grant" ? "Granted" : "Revoked" : allowed ? "Role: on" : "Role: off"}</span></button>; })}</div>)}</div>}</div>;
          })}
          <div className="sticky bottom-0 flex flex-col gap-3 border-t border-cream-2 bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center">
            <button disabled={own} onClick={status} className="mr-auto text-sm font-semibold text-rust disabled:text-stone">{member.active ? "Deactivate account" : "Reactivate account"}</button>
            {error && <span className="text-xs text-rust">{error}</span>}
            <button disabled={!dirty || saving || own || (!draft.locations.length && draft.role !== "admin")} onClick={save} className="rounded-lg bg-rust px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rust-deep disabled:cursor-not-allowed disabled:bg-fog">{saving ? "Saving…" : "Save changes"}</button>
          </div>
        </section>
      </div>
    </div>
  );
}

function RoleManager({ roles, setRoles, notify }: { roles: RoleDefinition[]; setRoles: (roles: RoleDefinition[]) => void; notify: (message: string) => void }) {
  const [selectedId, setSelectedId] = useState<RoleId>("manager");
  const role = roleById(roles, selectedId);
  const [draft, setDraft] = useState<PermissionKey[]>(role.permissions);
  const [saving, setSaving] = useState(false);
  const choose = (id: RoleId) => { setSelectedId(id); setDraft(roleById(roles, id).permissions); };
  const save = async () => {
    setSaving(true); const response = await fetch("/api/roles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedId, permissions: draft }) }); const data = await response.json(); setSaving(false);
    if (!response.ok) return notify(data.error ?? "Could not save role");
    setRoles(roles.map((item) => item.id === data.role.id ? data.role : item)); notify("Role defaults updated");
  };
  return <div className="mx-auto grid max-w-[1120px] gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[300px_1fr]"><aside className="h-fit overflow-hidden rounded-xl border border-cream-2 bg-white"><div className="border-b border-cream-2 p-5"><div className="eyebrow text-rust">Predefined roles</div><p className="mt-2 text-xs leading-relaxed text-stone">Changing a role updates its default bundle for everyone assigned to it. Personal overrides stay intact.</p></div>{roles.map((item) => <button key={item.id} onClick={() => choose(item.id)} className={`flex w-full items-center gap-3 border-b border-cream-2 px-5 py-4 text-left last:border-0 ${selectedId === item.id ? "bg-shell/55" : "hover:bg-cream"}`}><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.id === "admin" ? "bg-rust text-white" : "bg-cream text-charcoal"}`}>{icon(icons.shield, 18)}</span><span className="flex-1"><span className="block text-sm font-semibold">{item.name}</span><span className="text-[11px] text-stone">{item.permissions.length} permissions</span></span>{icon(icons.chevron, 15)}</button>)}</aside><section className="overflow-hidden rounded-xl border border-cream-2 bg-white"><div className="border-b border-cream-2 p-5"><div className="flex items-center gap-3"><h2 className="text-2xl">{role.name}</h2>{role.locked && <span className="rounded-full bg-cream px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.1em] text-stone">Locked</span>}</div><p className="mt-1 text-sm text-charcoal">{role.description}</p></div>{groups.map((group) => <div key={group.module} className="border-b border-cream-2 p-5 last:border-0"><div className="eyebrow mb-3 text-stone">{group.module}</div><div className="grid gap-2 sm:grid-cols-2">{group.permissions.map((permission) => { const checked = role.locked || draft.includes(permission.key); return <label key={permission.key} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${checked ? "border-rust/25 bg-shell/30" : "border-cream-2"}`}><input type="checkbox" disabled={role.locked} checked={checked} onChange={(event) => setDraft((items) => event.target.checked ? [...items, permission.key] : items.filter((item) => item !== permission.key))} className="mt-0.5 accent-rust"/><span><span className="block text-[13px] font-semibold">{permission.label}</span><span className="mt-0.5 block text-[11px] leading-snug text-stone">{permission.description}</span></span></label>; })}</div></div>)}{!role.locked && <div className="sticky bottom-0 flex justify-end border-t border-cream-2 bg-white/95 p-4 backdrop-blur"><button disabled={saving || JSON.stringify([...draft].sort()) === JSON.stringify([...role.permissions].sort())} onClick={save} className="rounded-lg bg-rust px-5 py-2.5 text-sm font-semibold text-white disabled:bg-fog">{saving ? "Saving…" : "Save role defaults"}</button></div>}</section></div>;
}

function InviteDialog({ roles, onClose, onInvited }: { roles: RoleDefinition[]; onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState(""); const [role, setRole] = useState<RoleId>("bar-floor-staff"); const [locations, setLocations] = useState<Location[]>(["Prologue"]); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submit = async () => { setSaving(true); setError(""); const response = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role, locations }) }); const data = await response.json(); setSaving(false); if (!response.ok) return setError(data.error ?? "Invite failed"); onInvited(); };
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="w-full max-w-[500px] overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="border-b border-cream-2 px-6 py-5"><div className="eyebrow text-rust">New team member</div><h2 className="mt-1 text-2xl">Invite someone</h2><p className="mt-1 text-sm text-stone">They’ll receive a secure sign-in invitation by email.</p></div><div className="space-y-5 p-6"><label className="block"><span className="text-xs font-semibold text-charcoal">Email address</span><input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className="mt-2 w-full rounded-lg border border-cream-2 px-3 py-2.5 text-sm outline-none focus:border-rust" /></label><label className="block"><span className="text-xs font-semibold text-charcoal">Base role</span><select value={role} onChange={(event) => { const next = event.target.value as RoleId; setRole(next); if (next === "admin") setLocations([...LOCATIONS]); }} className="mt-2 w-full rounded-lg border border-cream-2 bg-white px-3 py-2.5 text-sm font-semibold">{roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="mt-1.5 block text-xs text-stone">{roleById(roles, role).description}</span></label><div><span className="text-xs font-semibold text-charcoal">Locations</span><div className="mt-2 grid grid-cols-2 gap-2">{LOCATIONS.map((location) => <label key={location} className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-semibold ${locations.includes(location) ? "border-rust/30 bg-shell/35" : "border-cream-2"}`}><input disabled={role === "admin"} type="checkbox" checked={locations.includes(location)} onChange={(event) => setLocations((items) => event.target.checked ? [...items, location] : items.filter((item) => item !== location))} className="accent-rust"/>{location}</label>)}</div></div>{error && <p className="rounded-lg bg-shell p-3 text-xs text-rust">{error}</p>}</div><div className="flex justify-end gap-2 border-t border-cream-2 bg-cream/50 px-6 py-4"><button onClick={onClose} className="rounded-lg border border-cream-2 bg-white px-4 py-2.5 text-sm font-semibold">Cancel</button><button disabled={saving || !email || (!locations.length && role !== "admin")} onClick={submit} className="rounded-lg bg-rust px-4 py-2.5 text-sm font-semibold text-white disabled:bg-fog">{saving ? "Sending…" : "Send invitation"}</button></div></div></div>;
}
import { confirmAction } from "@/lib/dialogs";
