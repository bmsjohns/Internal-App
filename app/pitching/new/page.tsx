"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { EventVenue, Imprint } from "@/lib/types";
import { PITCH_LEADS, PITCH_PRIORITIES, PRIORITY_COLORS } from "@/lib/pitching";
import { btnGhost, btnPrimary } from "@/components/PageHeader";
import {
  Chevron,
  inputCls,
  labelCls,
  selectCls,
  selectWrap,
  textareaCls,
} from "@/components/pitching/PitchEditor";

const emptyDraft = {
  authorName: "",
  bookTitle: "",
  imprintId: "",
  priority: "",
  leadEmail: "",
  venueId: "",
  pitchingNotes: "",
};

/**
 * Quick-create screen per the design file: author + title up front (the only
 * required fields — §3.3 "early-stage record by nature"), a handful of
 * add-now-or-later fields, everything else on the edit screen after saving.
 * "Create & add another" keeps the entry-session pattern from Orders.
 */
export default function NewPitch() {
  const router = useRouter();
  const [draft, setDraft] = useState(emptyDraft);
  const [venues, setVenues] = useState<EventVenue[]>([]);
  const [imprints, setImprints] = useState<Imprint[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const authorRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof emptyDraft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  useEffect(() => {
    fetch("/api/pitching/meta")
      .then((r) => (r.ok ? r.json() : { venues: [], imprints: [] }))
      .then((d) => {
        setVenues(d.venues ?? []);
        setImprints(d.imprints ?? []);
      })
      .catch(() => {});
  }, []);

  async function save(addAnother: boolean) {
    setError("");
    if (!draft.authorName.trim()) return setError("Author name is required.");
    if (!draft.bookTitle.trim()) return setError("Book title is required.");
    setBusy(true);
    try {
      const res = await fetch("/api/pitches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: draft.authorName,
          bookTitle: draft.bookTitle,
          imprintIds: draft.imprintId ? [draft.imprintId] : [],
          priority: draft.priority,
          leadEmail: draft.leadEmail,
          proposedVenueIds: draft.venueId ? [draft.venueId] : [],
          pitchingNotes: draft.pitchingNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (addAnother) {
        setAdded((a) => [...a, `${draft.authorName} — ${draft.bookTitle}`]);
        setDraft(emptyDraft);
        setBusy(false);
        authorRef.current?.focus();
      } else {
        router.push("/pitching");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3.5 border-b-[1.5px] border-rust bg-cream px-5 pb-[18px] pt-[22px] sm:px-8">
        <Link
          href="/pitching"
          className="inline-flex items-center gap-1.5 rounded px-2.5 py-2 text-[13px] font-semibold text-charcoal hover:bg-ink/5"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Board
        </Link>
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-1 text-rust">Events · Pitching</div>
          <h1 className="m-0 text-[26px] leading-none">New pitch</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[720px] px-5 pb-12 pt-7 sm:px-8">
        <div className="mb-[26px] flex items-start gap-3 rounded-lg bg-shell px-[18px] py-3.5">
          <Image src="/assets/bird-reading.png" alt="" width={46} height={40} className="h-auto w-[46px] shrink-0" />
          <p className="m-0 text-[13.5px] leading-normal text-rust">
            Just the author and title to start — this is an early-stage record. Fill the rest in as
            the pitch develops.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-[18px]">
          <div>
            <label className={labelCls} htmlFor="author">
              Author name <span className="text-rust">*</span>
            </label>
            <input
              id="author"
              ref={authorRef}
              autoFocus
              value={draft.authorName}
              onChange={(e) => set("authorName", e.target.value)}
              className={`${inputCls} p-[13px] text-base`}
              placeholder="e.g. Douglas Stuart"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="title">
              Book title <span className="text-rust">*</span>
            </label>
            <input
              id="title"
              value={draft.bookTitle}
              onChange={(e) => set("bookTitle", e.target.value)}
              className={`${inputCls} p-[13px] text-base`}
              placeholder="e.g. In conversation + Q&A"
            />
          </div>
        </div>

        <div className="my-[26px] mb-[18px] flex items-center gap-2.5 text-[11px] uppercase tracking-[0.14em] text-stone">
          <span className="h-px flex-1 bg-cream-2" />
          Add now or later
          <span className="h-px flex-1 bg-cream-2" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="imprint">Imprint</label>
            <div className={selectWrap}>
              <select id="imprint" value={draft.imprintId} onChange={(e) => set("imprintId", e.target.value)} className={selectCls}>
                <option value="">—</option>
                {imprints.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                    {i.publisherName && i.publisherName !== i.name ? ` (${i.publisherName})` : ""}
                  </option>
                ))}
              </select>
              <Chevron />
            </div>
          </div>
          <div>
            <label className={labelCls}>Priority</label>
            <div className="flex gap-1.5">
              {PITCH_PRIORITIES.map((p) => {
                const active = draft.priority === p;
                const color = PRIORITY_COLORS[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set("priority", active ? "" : p)}
                    title={p}
                    className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-1 py-[11px] text-[12.5px] font-semibold"
                    style={
                      active
                        ? { borderColor: color, background: `${color}14`, color }
                        : { borderColor: "var(--color-cream-2)", background: "#fff", color: "var(--color-charcoal)" }
                    }
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                    {p === "Mission Critical" ? "Critical" : p}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="lead">Lead</label>
            <div className={selectWrap}>
              <select id="lead" value={draft.leadEmail} onChange={(e) => set("leadEmail", e.target.value)} className={selectCls}>
                <option value="">— Unassigned —</option>
                {PITCH_LEADS.map((l) => (
                  <option key={l.email} value={l.email}>
                    {l.name}
                  </option>
                ))}
              </select>
              <Chevron />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="venue">Proposed venue</label>
            <div className={selectWrap}>
              <select id="venue" value={draft.venueId} onChange={(e) => set("venueId", e.target.value)} className={selectCls}>
                <option value="">—</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.locations[0] ? ` — ${v.locations[0]}` : ""}
                  </option>
                ))}
              </select>
              <Chevron />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="notes">Pitching notes</label>
            <textarea
              id="notes"
              value={draft.pitchingNotes}
              onChange={(e) => set("pitchingNotes", e.target.value)}
              className={textareaCls}
              placeholder="Where the conversation’s at, who to chase, why it’s worth doing…"
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm font-semibold text-coral">{error}</p>}

        <div className="mt-[26px] flex items-center gap-2.5">
          <button onClick={() => save(false)} disabled={busy} className={btnPrimary}>
            {busy ? "Saving…" : "Create pitch"}
          </button>
          <button onClick={() => save(true)} disabled={busy} className={btnGhost}>
            Create &amp; add another
          </button>
        </div>

        {added.length > 0 && (
          <div className="mt-5 rounded-lg border border-cream-2 bg-white px-4 py-3">
            <div className="eyebrow mb-1.5 text-stone">Added this session</div>
            <ul className="m-0 list-none p-0 text-[13px] text-charcoal">
              {added.map((a, i) => (
                <li key={i} className="py-0.5">✓ {a}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
