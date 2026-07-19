"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Venue, VenueInput } from "@/lib/types";
import { VENUE_LOCATION_OPTIONS, VENUE_STATUS_OPTIONS } from "@/lib/events";
import { btnDanger, btnPrimary } from "@/components/PageHeader";
import { Chevron, inputCls, labelCls, panelCls, panelHead, selectCls, selectWrap, textareaCls } from "@/components/form";

const emptyVenue = (): Venue => ({
  id: "", name: "", capacity: "", locations: [], status: "", tags: [], notes: "", techSpec: [], photo: [], eventIds: [],
});

/** Venue detail/edit + new (§5.3) — plain CRUD with an explicit save. */
export default function VenueEditor({ initial, canEdit = true }: { initial?: Venue; canEdit?: boolean }) {
  const router = useRouter();
  const isNew = !initial;
  const [draft, setDraft] = useState<Venue>(initial ?? emptyVenue());
  const [tagText, setTagText] = useState(draft.tags.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof VenueInput>(key: K, value: VenueInput[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    if (!canEdit) return;
    if (!draft.name.trim()) {
      setError("Venue name is required");
      return;
    }
    setBusy(true);
    setError("");
    const body = {
      name: draft.name,
      capacity: draft.capacity,
      locations: draft.locations,
      status: draft.status,
      tags: tagText.split(",").map((t) => t.trim()).filter(Boolean),
      notes: draft.notes,
    };
    try {
      const res = await fetch(isNew ? "/api/venues" : `/api/venues/${draft.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      router.push("/venues");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save the venue");
      setBusy(false);
    }
  }

  async function remove() {
    if (!canEdit) return;
    if (isNew || !(await confirmAction(`Delete “${draft.name}”? This cannot be undone.`, "Delete venue"))) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/venues/${draft.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      router.push("/venues");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t delete the venue");
      setBusy(false);
    }
  }

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      <header className="sticky top-[52px] z-10 flex flex-wrap items-center gap-3 border-b-[1.5px] border-rust bg-cream px-4 pb-3.5 pt-4 sm:px-8 sm:pt-[22px] lg:top-0">
        <Link href="/venues" className="inline-flex items-center gap-1.5 rounded px-2 py-2 text-[13px] font-semibold text-charcoal hover:bg-ink/5">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Venues
        </Link>
        <div className="min-w-[160px] flex-1">
          <div className="eyebrow mb-1 text-rust">{isNew ? "New venue" : "Venue"}</div>
          <h1 className="m-0 truncate text-[24px] leading-none sm:text-[26px]">{draft.name || "Untitled venue"}</h1>
        </div>
        {canEdit && <div className="flex gap-2">
          {!isNew && <button onClick={remove} disabled={busy || draft.eventIds.length > 0} className={btnDanger}>Delete</button>}
          <button onClick={save} disabled={busy} className={btnPrimary}>
            {busy ? "Saving…" : "Save venue"}
          </button>
        </div>}
      </header>

      <div className="grid w-full max-w-[1040px] items-start gap-6 px-4 pb-12 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
        <div className="flex flex-col gap-5">
          {error && <p className="m-0 rounded-lg border border-blush bg-shell px-4 py-3 text-[13px] font-semibold text-rust">{error}</p>}
          {!canEdit && <p className="m-0 rounded-lg border border-cream-2 bg-white px-4 py-3 text-[13px] text-charcoal">Read-only access</p>}
          {draft.photo[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.photo[0].url} alt={draft.name} className="max-h-[240px] w-full rounded-lg border border-cream-2 object-cover" />
          )}
          <section className={panelCls}>
            <span className={panelHead}>Details</span>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="v-name">Name</label>
                <input id="v-name" value={draft.name} onChange={(e) => set("name", e.target.value)} className={inputCls} disabled={!canEdit} />
              </div>
              <div>
                <label className={labelCls} htmlFor="v-cap">Capacity</label>
                <input id="v-cap" value={draft.capacity} onChange={(e) => set("capacity", e.target.value)} className={inputCls} placeholder="e.g. 150" disabled={!canEdit} />
              </div>
              <div>
                <span className={labelCls}>Location</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {VENUE_LOCATION_OPTIONS.map((l) => {
                    const on = draft.locations.includes(l);
                    return (
                      <button
                        key={l}
                        disabled={!canEdit}
                        onClick={() => set("locations", on ? draft.locations.filter((x) => x !== l) : [...draft.locations, l])}
                        className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] ${on ? "border-rust bg-shell font-semibold text-rust" : "border-cream-2 bg-white text-charcoal"}`}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="v-notes">Notes</label>
                <textarea id="v-notes" value={draft.notes} onChange={(e) => set("notes", e.target.value)} className={textareaCls} placeholder="Load-in, AV, quirks of the room…" disabled={!canEdit} />
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <div className={panelCls}>
            <span className={panelHead}>Status</span>
            <div className={selectWrap}>
              <select value={draft.status} onChange={(e) => set("status", e.target.value)} className={selectCls} aria-label="Status" disabled={!canEdit}>
                <option value="">—</option>
                {VENUE_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <Chevron />
            </div>
            {!isNew && (
              <div className="mt-3.5 text-[12.5px] text-charcoal">
                {draft.eventIds.length} event{draft.eventIds.length === 1 ? "" : "s"} booked here
              </div>
            )}
          </div>
          <div className={panelCls}>
            <span className={panelHead}>Tags</span>
            <input value={tagText} onChange={(e) => setTagText(e.target.value)} className={inputCls} placeholder="Ticketed, Bar, Schools…" disabled={!canEdit} />
            <p className="mb-0 mt-1.5 text-[11.5px] text-stone">Comma-separated.</p>
            {draft.techSpec.length > 0 && (
              <>
                <span className={`${panelHead} mt-4`}>Technical spec</span>
                {draft.techSpec.map((a) => (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border border-dashed border-cream-2 bg-cream px-3 py-2.5 text-[13px] text-charcoal">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.49-8.48" /></svg>
                    <span className="truncate">{a.filename}</span>
                  </a>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
import { confirmAction } from "@/lib/dialogs";
