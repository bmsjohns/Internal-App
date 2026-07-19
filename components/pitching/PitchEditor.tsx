"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EventVenue, Imprint, Location, Pitch } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";
import { PITCH_LEADS, PITCH_PRIORITIES, PITCH_STAGES, pitchStage, PRIORITY_COLORS } from "@/lib/pitching";
import { VENUES } from "@/lib/config";
import { btnDanger, btnPrimary } from "@/components/PageHeader";
import { RatingStars } from "./chips";

// Field styling from the design file ("Order Book.dc.html"): 10px caps
// labels, 6px-radius inputs, chevroned selects.
export const labelCls = "eyebrow mb-[7px] block text-charcoal";
export const inputCls =
  "w-full rounded-md border border-cream-2 bg-white px-[13px] py-[11px] text-[14.5px] text-ink";
export const selectWrap = "relative";
export const selectCls = `${inputCls} cursor-pointer appearance-none pr-[34px]`;
export const textareaCls = `${inputCls} min-h-[84px] resize-y leading-normal`;

export const Chevron = () => (
  <svg
    className="pointer-events-none absolute right-3 top-[17px] text-stone"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const panelCls = "rounded-lg border border-cream-2 bg-white px-5 py-[18px]";
const panelHead = "eyebrow mb-3 block text-stone";

const fmtSize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

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
 * Combined pitch detail/edit screen — the design file has ONE "Edit pitch"
 * screen rather than a read view with a separate edit mode: left column is
 * the book/pitch content, right rail is Pipeline / People / Proposed venues.
 * Save writes everything in one PATCH; status only when the stage changed,
 * so raw legacy Airtable options are preserved.
 */
export default function PitchEditor({ pitch }: { pitch: Pitch }) {
  const router = useRouter();
  const initialStageKey = pitchStage(pitch.status).key;
  const [draft, setDraft] = useState<Draft>({
    authorName: pitch.authorName,
    bookTitle: pitch.bookTitle,
    isbn: pitch.isbn,
    imprintIds: pitch.imprintIds,
    publicationDate: pitch.publicationDate ?? "",
    stageKey: initialStageKey,
    priority: pitch.priority,
    initialHighPriority: pitch.initialHighPriority,
    leadEmail: pitch.leadEmail,
    publicist: pitch.publicist,
    publicistEmail: pitch.publicistEmail,
    proposedVenueIds: pitch.proposedVenueIds,
    proposedDates: pitch.proposedDates,
    estimatedAudienceSize: pitch.estimatedAudienceSize,
    pitchingNotes: pitch.pitchingNotes,
    opportunityNotes: pitch.opportunityNotes,
    rating: pitch.rating,
    location: pitch.location,
  });
  const [deck, setDeck] = useState(pitch.pitchDeck);
  const [venues, setVenues] = useState<EventVenue[]>([]);
  const [imprints, setImprints] = useState<Imprint[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
  const derivedPublisher = pickedImprint?.publisherName || pitch.publisherNames.join(", ") || "";
  const isWon = pitchStage(pitch.status).key === "won";

  async function save() {
    setError("");
    // Only author is enforced here: title is required on CREATE (§3.3), but
    // plenty of live records predate that rule and must stay saveable.
    if (!draft.authorName.trim()) return setError("Author name is required.");
    setBusy(true);
    try {
      const { stageKey, ...rest } = draft;
      const payload: Record<string, unknown> = { ...rest, publicationDate: draft.publicationDate || null };
      if (stageKey !== initialStageKey) {
        payload.status = PITCH_STAGES.find((s) => s.key === stageKey)!.writeAs;
      }
      const res = await fetch(`/api/pitches/${pitch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push("/pitching");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!(await confirmAction(`Delete the pitch for ${pitch.authorName}? This can’t be undone.`, "Delete pitch"))) return;
    setBusy(true);
    const res = await fetch(`/api/pitches/${pitch.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/pitching");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn’t delete — you may not have pitching:delete access.");
      setBusy(false);
    }
  }

  async function uploadDeck(file: File) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/pitches/${pitch.id}/deck`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setDeck(data.pitch.pitchDeck);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
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

  const priorityPill = (p: string) => {
    const active = draft.priority === p;
    const color = PRIORITY_COLORS[p];
    return (
      <button
        key={p}
        type="button"
        onClick={() => set("priority", active ? "" : p)}
        className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-1.5 py-[9px] text-[13px] font-semibold"
        style={
          active
            ? { borderColor: color, background: `${color}14`, color }
            : { borderColor: "var(--color-cream-2)", background: "#fff", color: "var(--color-charcoal)" }
        }
      >
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {p}
      </button>
    );
  };

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      {/* Sticky action header (design: back · title · convert/delete/save) */}
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3.5 border-b-[1.5px] border-rust bg-cream px-5 pb-[18px] pt-[22px] sm:px-8">
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
          <div className="eyebrow mb-1 text-rust">Pitch · {pitch.authorName || "Untitled"}</div>
          <h1 className="m-0 text-[26px] leading-none">Edit pitch</h1>
        </div>
        {isWon && (
          <Link
            href={`/events/new?fromPitch=${pitch.id}`}
            className="inline-flex items-center gap-2 rounded border-[1.5px] border-rust bg-white px-[15px] py-[9px] text-[13px] font-semibold text-rust hover:bg-shell"
          >
            Convert to booking →
          </Link>
        )}
        <button onClick={remove} disabled={busy} className={btnDanger}>
          Delete
        </button>
        <button onClick={save} disabled={busy} className={btnPrimary}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </header>

      <div className="mx-auto grid w-full max-w-[1140px] grid-cols-1 gap-7 px-5 pb-12 pt-6 sm:px-8 lg:grid-cols-[1.5fr_1fr]">
        {/* LEFT: main editable fields */}
        <div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelCls} htmlFor="author">
                Author name <span className="text-rust">*</span>
              </label>
              <input id="author" value={draft.authorName} onChange={(e) => set("authorName", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="title">
                Book title
              </label>
              <input id="title" value={draft.bookTitle} onChange={(e) => set("bookTitle", e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr]">
            <div>
              <label className={labelCls} htmlFor="isbn">ISBN</label>
              <input id="isbn" value={draft.isbn} onChange={(e) => set("isbn", e.target.value)} className={`${inputCls} font-mono`} placeholder="—" />
            </div>
            <div>
              <label className={labelCls} htmlFor="pubdate">Publication date</label>
              <input id="pubdate" type="date" value={draft.publicationDate} onChange={(e) => set("publicationDate", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Imprint (write) + Publisher (derived) */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="imprint">Imprint</label>
              <div className={selectWrap}>
                <select id="imprint" value={draft.imprintIds[0] ?? ""} onChange={(e) => set("imprintIds", e.target.value ? [e.target.value] : [])} className={selectCls}>
                  <option value="">— None yet —</option>
                  {imprints.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <Chevron />
              </div>
            </div>
            <div>
              <label className={labelCls}>Publisher</label>
              <div className={`${inputCls} bg-cream text-charcoal`}>{derivedPublisher || "—"}</div>
            </div>
          </div>
          <div className="mt-2.5 flex items-start gap-2 rounded-md border border-blush bg-shell px-[13px] py-2.5">
            <svg className="mt-px shrink-0 text-rust" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
            <span className="text-[12.5px] leading-snug text-rust">
              Publisher fills in from the imprint — the direct Publisher link in Airtable becomes a
              read-only lookup when the Phase 0 schema fix lands.
            </span>
          </div>

          <div className="mt-5">
            <label className={labelCls} htmlFor="dates">
              Proposed dates <span className="normal-case tracking-normal text-stone">— free text</span>
            </label>
            <textarea id="dates" value={draft.proposedDates} onChange={(e) => set("proposedDates", e.target.value)} className={textareaCls} />
            <div className="mt-[5px] flex items-center gap-1.5 text-[11.5px] text-stone">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 21V4M4 4h13l-2 4 2 4H4" />
              </svg>
              Free text today — worth tightening to a real date field later (out of scope for Phase 1).
            </div>
          </div>

          <div className="mt-4">
            <label className={labelCls} htmlFor="audience">
              Estimated audience size <span className="normal-case tracking-normal text-stone">— free text</span>
            </label>
            <input id="audience" value={draft.estimatedAudienceSize} onChange={(e) => set("estimatedAudienceSize", e.target.value)} className={inputCls} placeholder="e.g. 120–150, ticketed" />
          </div>

          <div className="mt-5">
            <label className={labelCls} htmlFor="notes">Pitching notes</label>
            <textarea id="notes" value={draft.pitchingNotes} onChange={(e) => set("pitchingNotes", e.target.value)} className={textareaCls} />
          </div>

          <div className="mt-4">
            <label className={labelCls} htmlFor="opportunity">
              Opportunity notes <span className="normal-case tracking-normal text-stone">— rich text (markdown)</span>
            </label>
            <div className="overflow-hidden rounded-md border border-cream-2 bg-white">
              <div className="border-b border-cream-2 bg-cream px-2.5 py-1.5 text-[11.5px] text-stone">
                **bold** · _italic_ · - bullets — renders in Airtable
              </div>
              <textarea
                id="opportunity"
                value={draft.opportunityNotes}
                onChange={(e) => set("opportunityNotes", e.target.value)}
                className={`${textareaCls} min-h-[96px] rounded-none border-none`}
              />
            </div>
          </div>

          {/* Pitch deck */}
          <div className="mt-5">
            <label className={labelCls}>Pitch deck</label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) uploadDeck(f);
              }}
              className="flex flex-col gap-2.5 rounded-lg border-[1.5px] border-dashed border-cream-2 bg-white px-4 py-3.5"
            >
              {deck.map((a) => (
                <div key={a.id} className="flex items-center gap-[11px]">
                  <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md bg-shell text-rust">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M21 12.5l-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8L13 5a3.7 3.7 0 0 1 5.2 5.2L10 18.4a1.8 1.8 0 0 1-2.6-2.6L15 8.3" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1 leading-snug">
                    <div className="truncate text-[13.5px] font-semibold text-ink">{a.filename}</div>
                    <div className="text-xs text-stone">{fmtSize(a.size)}</div>
                  </div>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded border-[1.5px] border-cream-2 bg-white px-[13px] py-[7px] text-[12.5px] font-semibold text-charcoal hover:border-ink hover:text-ink"
                  >
                    View
                  </a>
                </div>
              ))}
              <div
                className={`text-center text-[12.5px] text-stone ${deck.length > 0 ? "border-t border-dashed border-cream-2 pt-2.5" : "py-1"}`}
              >
                {uploading ? (
                  "Uploading…"
                ) : (
                  <>
                    Drop a file, or{" "}
                    <button type="button" onClick={() => fileRef.current?.click()} className="cursor-pointer font-semibold text-rust">
                      browse
                    </button>{" "}
                    to add {deck.length > 0 ? "another" : "one"} · 5MB max
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadDeck(e.target.files[0])} />
            </div>
          </div>
        </div>

        {/* RIGHT: pipeline / people / venues rails */}
        <div className="flex flex-col gap-4">
          <section className={panelCls}>
            <span className={panelHead}>Pipeline</span>
            <label className={labelCls} htmlFor="stage">Stage</label>
            <div className={`${selectWrap} mb-1`}>
              <select id="stage" value={draft.stageKey} onChange={(e) => set("stageKey", e.target.value)} className={selectCls}>
                {PITCH_STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Chevron />
            </div>
            {draft.stageKey === initialStageKey && pitch.status && pitch.status !== pitchStage(pitch.status).writeAs && (
              <p className="mb-0 mt-1 text-[11.5px] text-stone">Airtable status: “{pitch.status}” — kept unless you pick a new stage.</p>
            )}
            <label className={`${labelCls} mt-4`}>Priority</label>
            <div className="flex gap-1.5">{PITCH_PRIORITIES.map(priorityPill)}</div>
            <label className="mt-3.5 flex cursor-pointer items-center gap-[9px] text-sm text-charcoal">
              <input type="checkbox" checked={draft.initialHighPriority} onChange={(e) => set("initialHighPriority", e.target.checked)} className="h-4 w-4 accent-rust" />
              Initial high priority
            </label>
            <div className="mt-4 border-t border-cream-2 pt-3.5">
              <label className={labelCls}>Rating</label>
              <div className="flex items-center gap-2">
                <RatingStars rating={draft.rating} onChange={(r) => set("rating", r)} size={16} />
                <span className="text-[13px] text-stone">{draft.rating ? `${draft.rating} / 5` : "unrated"}</span>
              </div>
            </div>
            <div className="mt-4 border-t border-cream-2 pt-3.5">
              <label className={labelCls}>Shop</label>
              <div className="flex gap-1.5">
                {LOCATIONS.map((l) => {
                  const active = draft.location === l;
                  const dot = l === "Prologue" ? VENUES.prologue.color : VENUES.simply.color;
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => set("location", active ? null : l)}
                      className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-1.5 py-[9px] text-[13px] font-semibold ${
                        active ? "border-rust bg-shell text-rust" : "border-cream-2 bg-white text-charcoal"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className={panelCls}>
            <span className={panelHead}>People</span>
            <label className={labelCls} htmlFor="lead">Lead</label>
            <div className={`${selectWrap} mb-3`}>
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
            <label className={labelCls} htmlFor="publicist">Publicist</label>
            <input id="publicist" value={draft.publicist} onChange={(e) => set("publicist", e.target.value)} className={`${inputCls} mb-3`} placeholder="External contact" />
            <label className={labelCls} htmlFor="pubemail">Publicist’s email</label>
            <input id="pubemail" type="email" value={draft.publicistEmail} onChange={(e) => set("publicistEmail", e.target.value)} className={inputCls} placeholder="name@publisher.co.uk" />
          </section>

          <section className={panelCls}>
            <span className={panelHead}>Proposed venues</span>
            <div className="flex flex-wrap gap-[7px]">
              {venues.map((v) => {
                const on = draft.proposedVenueIds.includes(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggleVenue(v.id)}
                    className={`inline-flex cursor-pointer items-center gap-[7px] rounded-full border px-3 py-1.5 text-[12.5px] ${
                      on ? "border-rust bg-shell font-semibold text-rust" : "border-cream-2 bg-white font-medium text-charcoal"
                    }`}
                  >
                    {on && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                    {v.name}
                  </button>
                );
              })}
              {venues.length === 0 && <span className="text-sm text-stone">Loading venues…</span>}
            </div>
            <div className="mt-[11px] flex items-start gap-1.5 text-[11.5px] text-stone">
              <svg className="mt-px shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 21V4M4 4h13l-2 4 2 4H4" />
              </svg>
              Phase 1 lets you pick existing venues only. Need a new one? Add it in Airtable for now —
              venue management arrives in Phase 2.
            </div>
          </section>

          {error && <p className="m-0 text-sm font-semibold text-coral">{error}</p>}
        </div>
      </div>
    </div>
  );
}
import { confirmAction } from "@/lib/dialogs";
