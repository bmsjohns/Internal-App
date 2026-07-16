"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Host, ShowEvent } from "@/lib/types";
import { fmtEventDate } from "@/lib/events";
import { initialsOf } from "@/lib/config";
import { btnPrimary } from "@/components/PageHeader";
import { inputCls, labelCls, panelCls, panelHead, textareaCls } from "@/components/form";

const emptyHost = (): Host => ({
  id: "", name: "", phone: "", email: "", fee: null, instagram: "", notes: "", teamContacts: [], eventIds: [],
});

/** Host detail/edit + new (§5.4). */
export default function HostEditor({ initial }: { initial?: Host }) {
  const router = useRouter();
  const isNew = !initial;
  const [draft, setDraft] = useState<Host>(initial ?? emptyHost());
  const [events, setEvents] = useState<ShowEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // "Events with this host" rail — names resolved from the events list.
  useEffect(() => {
    if (isNew || initial.eventIds.length === 0) return;
    fetch("/api/events")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => setEvents((d.events as ShowEvent[]).filter((e) => initial.eventIds.includes(e.id))))
      .catch(() => {});
  }, [isNew, initial]);

  const set = <K extends keyof Host>(key: K, value: Host[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    if (!draft.name.trim()) {
      setError("Host name is required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(isNew ? "/api/hosts" : `/api/hosts/${draft.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          phone: draft.phone,
          email: draft.email,
          fee: draft.fee,
          instagram: draft.instagram,
          notes: draft.notes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      router.push("/hosts");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save the host");
      setBusy(false);
    }
  }

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      <header className="sticky top-[52px] z-10 flex flex-wrap items-center gap-3 border-b-[1.5px] border-rust bg-cream px-4 pb-3.5 pt-4 sm:px-8 sm:pt-[22px] lg:top-0">
        <Link href="/hosts" className="inline-flex items-center gap-1.5 rounded px-2 py-2 text-[13px] font-semibold text-charcoal hover:bg-ink/5">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Hosts
        </Link>
        <div className="min-w-[160px] flex-1">
          <div className="eyebrow mb-1 text-rust">{isNew ? "New host" : "Host"}</div>
          <h1 className="m-0 truncate text-[24px] leading-none sm:text-[26px]">{draft.name || "Untitled host"}</h1>
        </div>
        <button onClick={save} disabled={busy} className={btnPrimary}>
          {busy ? "Saving…" : "Save host"}
        </button>
      </header>

      <div className="grid w-full max-w-[1040px] items-start gap-6 px-4 pb-12 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
        <div className="flex flex-col gap-5">
          {error && <p className="m-0 rounded-lg border border-blush bg-shell px-4 py-3 text-[13px] font-semibold text-rust">{error}</p>}
          <section className={panelCls}>
            <span className={panelHead}>Details</span>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="h-name">Name</label>
                <input id="h-name" value={draft.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="h-phone">Phone</label>
                <input id="h-phone" type="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="h-email">Email</label>
                <input id="h-email" type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="h-fee">Standard fee (£)</label>
                <input
                  id="h-fee"
                  inputMode="numeric"
                  value={draft.fee === null ? "" : String(draft.fee)}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    set("fee", v === "" ? null : Math.max(0, parseInt(v, 10) || 0));
                  }}
                  className={inputCls}
                  placeholder="0 = no fee"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="h-ig">Instagram</label>
                <input id="h-ig" value={draft.instagram} onChange={(e) => set("instagram", e.target.value)} className={inputCls} placeholder="instagram.com/…" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="h-notes">Notes</label>
                <textarea id="h-notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} className={textareaCls} placeholder="What they’re great at, briefing preferences…" />
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <div className={panelCls}>
            <span className={panelHead}>Team contact(s)</span>
            {draft.teamContacts.length > 0 ? (
              <div className="flex flex-col gap-2">
                {draft.teamContacts.map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5 text-[13px]">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cream-2 text-[10px] font-semibold">{initialsOf(c.name)}</span>
                    <span className="font-semibold">{c.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="m-0 text-[13px] text-stone">None yet — set in Airtable (collaborator field).</p>
            )}
          </div>
          {!isNew && (
            <div className={panelCls}>
              <span className={panelHead}>Events with this host</span>
              {initial.eventIds.length === 0 && <p className="m-0 text-[13px] text-stone">None yet.</p>}
              <div className="flex flex-col gap-1">
                {events.map((e) => (
                  <Link key={e.id} href={`/events/${e.id}`} className="flex items-center justify-between gap-2.5 rounded-md px-1.5 py-2 hover:bg-ink/5">
                    <span className="truncate text-[13px] font-semibold">{e.name}</span>
                    <span className="shrink-0 text-xs text-stone">{fmtEventDate(e.date)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
