"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EventVenue, Imprint, Location, Pitch } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";
import { PITCH_LEADS, PITCH_PRIORITIES, PITCH_STAGES, pitchStage } from "@/lib/pitching";
import { btnGhost, btnPrimary } from "@/components/PageHeader";
import { RatingStars } from "./chips";

const labelCls = "eyebrow mb-[7px] block text-charcoal";
const inputCls =
  "w-full rounded-md border border-cream-2 bg-white px-[13px] py-[11px] text-[14.5px] text-ink";
const segBtn = (active: boolean) =>
  `flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-1.5 py-2.5 text-[13px] font-semibold ${
    active ? "border-rust bg-shell text-rust" : "border-cream-2 bg-white text-charcoal"
  }`;

interface Draft {
  authorName: string;
  bookTitle: string;
  isbn: string;
  imprintIds: string[];
  publicationDate: string;
  stageKey: string;
  priority: string;
  initialHighPriority: boolean;
  leadEmail: string;
  publicist: string;
  publicistEmail: string;
  proposedVenueIds: string[];
  proposedDates: string;
  estimatedAudienceSize: string;
  pitchingNotes: string;
  opportunityNotes: string;
  rating: number | null;
  location: Location | null;
}

/**
 * Shared create/edit form (§3.2, §3.3). Only Author Name + Book Title are
 * required — a pitch is an early-stage record by nature. Status is edited as
 * a canonical stage and saved as the stage's `writeAs` Airtable option; an
 * unchanged status is not sent, so raw legacy values are preserved.
 */
export default function PitchForm({ pitch }: { pitch?: Pitch }) {
  const editing = !!pitch;
  const router = useRouter();
  const initialStageKey = pitch ? pitchStage(pitch.status).key : "wishlist";
  const [draft, setDraft] = useState<Draft>({
    authorName: pitch?.authorName ?? "",
    bookTitle: pitch?.bookTitle ?? "",
    isbn: pitch?.isbn ?? "",
    imprintIds: pitch?.imprintIds ?? [],
    publicationDate: pitch?.publicationDate ?? "",
    stageKey: initialStageKey,
    priority: pitch?.priority ?? "",
    initialHighPriority: pitch?.initialHighPriority ?? false,
    leadEmail: pitch?.leadEmail ?? "",
    publicist: pitch?.publicist ?? "",
    publicistEmail: pitch?.publicistEmail ?? "",
    proposedVenueIds: pitch?.proposedVenueIds ?? [],
    proposedDates: pitch?.proposedDates ?? "",
    estimatedAudienceSize: pitch?.estimatedAudienceSize ?? "",
    pitchingNotes: pitch?.pitchingNotes ?? "",
    opportunityNotes: pitch?.opportunityNotes ?? "",
    rating: pitch?.rating ?? null,
    location: pitch?.location ?? null,
  });
  const [venues, setVenues] = useState<EventVenue[]>([]);
  const [imprints, setImprints] = useState<Imprint[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  useEffect(() => {
    fetch("/api/pitching/meta")
      .then((r) => (r.ok ? r.json() : { venues: [], imprints: [] }))
      .then((d) => {
        setVenues(d.venues ?? []);
        setImprints(d.imprints ?? []);
      })
      .catch(() => {});
  }, []);

  const pickedImprint = imprints.find((i) => i.id === draft.imprintIds[0]);
  // Publisher is derived read-only (§3.2): from the picked imprint, falling
  // back to the pitch's legacy direct Publisher link.
  const derivedPublisher = pickedImprint?.publisherName || pitch?.publisherNames.join(", ") || "";

  async function save() {
    setError("");
    if (!draft.authorName.trim()) return setError("Author name is required.");
    if (!draft.bookTitle.trim()) return setError("Book title is required.");
    setBusy(true);
    try {
      const { stageKey, ...rest } = draft;
      const payload: Record<string, unknown> = {
        ...rest,
        publicationDate: draft.publicationDate || null,
      };
      // Only write status when the stage actually changed, preserving raw
      // legacy options (e.g. "Opportunity from London") otherwise.
      if (!editing || stageKey !== initialStageKey) {
        payload.status = PITCH_STAGES.find((s) => s.key === stageKey)!.writeAs;
      }
      const res = await fetch(editing ? `/api/pitches/${pitch!.id}` : "/api/pitches", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/pitching/${data.pitch.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  function toggleVenue(id: string) {
    set(
      "proposedVenueIds",
      draft.proposedVenueIds.includes(id)
        ? draft.proposedVenueIds.filter((v) => v !== id)
        : [...draft.proposedVenueIds, id]
    );
  }

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 pb-10 pt-6 sm:px-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="author">
            Author name <span className="text-rust">*</span>
          </label>
          <input id="author" value={draft.authorName} onChange={(e) => set("authorName", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="title">
            Book title <span className="text-rust">*</span>
          </label>
          <input id="title" value={draft.bookTitle} onChange={(e) => set("bookTitle", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="isbn">ISBN</label>
          <input id="isbn" value={draft.isbn} onChange={(e) => set("isbn", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="pubdate">Publication date</label>
          <input id="pubdate" type="date" value={draft.publicationDate} onChange={(e) => set("publicationDate", e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className={labelCls} htmlFor="imprint">Imprint</label>
          <select
            id="imprint"
            value={draft.imprintIds[0] ?? ""}
            onChange={(e) => set("imprintIds", e.target.value ? [e.target.value] : [])}
            className={`${inputCls} cursor-pointer`}
          >
            <option value="">— None yet —</option>
            {imprints.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
                {i.publisherName && i.publisherName !== i.name ? ` (${i.publisherName})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Publisher (from imprint)</label>
          <div className={`${inputCls} bg-cream text-charcoal`}>{derivedPublisher || "—"}</div>
        </div>

        <div>
          <label className={labelCls} htmlFor="stage">Stage</label>
          <select id="stage" value={draft.stageKey} onChange={(e) => set("stageKey", e.target.value)} className={`${inputCls} cursor-pointer`}>
            {PITCH_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          {editing && draft.stageKey === initialStageKey && pitch!.status && pitch!.status !== pitchStage(pitch!.status).writeAs && (
            <p className="mt-1 text-[11.5px] text-stone">Airtable status: “{pitch!.status}” — kept unless you pick a new stage.</p>
          )}
        </div>
        <div>
          <label className={labelCls} htmlFor="lead">Lead</label>
          <select id="lead" value={draft.leadEmail} onChange={(e) => set("leadEmail", e.target.value)} className={`${inputCls} cursor-pointer`}>
            <option value="">— Unassigned —</option>
            {PITCH_LEADS.map((l) => (
              <option key={l.email} value={l.email}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls}>Priority</label>
          <div className="flex gap-1.5">
            {PITCH_PRIORITIES.map((p) => (
              <button key={p} type="button" onClick={() => set("priority", draft.priority === p ? "" : p)} className={segBtn(draft.priority === p)}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal">
            <input type="checkbox" checked={draft.initialHighPriority} onChange={(e) => set("initialHighPriority", e.target.checked)} className="h-4 w-4 accent-rust" />
            Initial high priority
          </label>
          <span className="flex items-center gap-2">
            <span className="eyebrow text-charcoal">Rating</span>
            <RatingStars rating={draft.rating} onChange={(r) => set("rating", r)} size={17} />
          </span>
          <span className="flex items-center gap-2">
            <span className="eyebrow text-charcoal">Shop</span>
            <span className="flex gap-1.5">
              {LOCATIONS.map((l) => (
                <button key={l} type="button" onClick={() => set("location", draft.location === l ? null : l)} className={segBtn(draft.location === l)}>
                  {l}
                </button>
              ))}
            </span>
          </span>
        </div>

        <div>
          <label className={labelCls} htmlFor="publicist">Publicist</label>
          <input id="publicist" value={draft.publicist} onChange={(e) => set("publicist", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="pubemail">Publicist’s email</label>
          <input id="pubemail" type="email" value={draft.publicistEmail} onChange={(e) => set("publicistEmail", e.target.value)} className={inputCls} />
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls}>
            Proposed venue(s){" "}
            <span className="normal-case tracking-normal text-stone">— missing one? Add it in Airtable for now (Venues screens land in Phase 2)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {venues.map((v) => {
              const active = draft.proposedVenueIds.includes(v.id);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggleVenue(v.id)}
                  className={`cursor-pointer whitespace-nowrap rounded-full border px-[13px] py-[7px] text-[12.5px] font-semibold ${
                    active ? "border-rust bg-rust text-cream" : "border-cream-2 bg-white text-charcoal"
                  }`}
                >
                  {v.name}
                  {v.locations[0] && <span className="ml-1 opacity-60">· {v.locations[0]}</span>}
                </button>
              );
            })}
            {venues.length === 0 && <span className="text-sm text-stone">Loading venues…</span>}
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="dates">Proposed dates</label>
          <textarea id="dates" rows={2} value={draft.proposedDates} onChange={(e) => set("proposedDates", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="audience">Estimated audience size</label>
          <input id="audience" value={draft.estimatedAudienceSize} onChange={(e) => set("estimatedAudienceSize", e.target.value)} className={inputCls} />
        </div>

        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="notes">Pitching notes</label>
          <textarea id="notes" rows={3} value={draft.pitchingNotes} onChange={(e) => set("pitchingNotes", e.target.value)} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="opportunity">Opportunity notes</label>
          <textarea id="opportunity" rows={3} value={draft.opportunityNotes} onChange={(e) => set("opportunityNotes", e.target.value)} className={inputCls} />
        </div>
      </div>

      {error && <p className="mt-4 text-sm font-semibold text-coral">{error}</p>}

      <div className="mt-6 flex items-center gap-2.5">
        <button onClick={save} disabled={busy} className={btnPrimary}>
          {busy ? "Saving…" : editing ? "Save changes" : "Add pitch"}
        </button>
        <button onClick={() => router.back()} disabled={busy} className={btnGhost}>
          Cancel
        </button>
        {!editing && (
          <span className="text-[12.5px] text-stone">Pitch decks can be attached once the pitch is saved.</span>
        )}
      </div>
    </div>
  );
}
