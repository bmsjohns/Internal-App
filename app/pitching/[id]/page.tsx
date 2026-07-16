"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Pitch } from "@/lib/types";
import { pitchStage } from "@/lib/pitching";
import PageHeader, { btnDanger, btnGhost, btnPrimary } from "@/components/PageHeader";
import { PriorityChip, RatingStars, StageChip } from "@/components/pitching/chips";

const rowCls = "grid grid-cols-[150px_1fr] gap-3 border-b border-cream-2 py-2.5 text-sm";
const keyCls = "eyebrow pt-0.5 text-stone";

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className={rowCls}>
      <div className={keyCls}>{k}</div>
      <div className="min-w-0 text-charcoal">{children}</div>
    </div>
  );
}

const fmtSize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function PitchDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/pitches/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status === 403 ? "No pitching access" : `HTTP ${r.status}`))))
      .then((d) => setPitch(d.pitch))
      .catch((e) => setError(e.message));
  }, [id]);

  async function uploadDeck(file: File) {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/pitches/${id}/deck`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPitch(data.pitch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    if (!pitch) return;
    if (!confirm(`Delete the pitch for ${pitch.authorName}? This can’t be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/pitches/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/pitching");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn’t delete — you may not have pitching:delete access.");
      setBusy(false);
    }
  }

  if (error && !pitch) {
    return (
      <div className="ob-screen">
        <PageHeader eyebrow="Events · Pitching" title="Pitch" backHref="/pitching" />
        <p className="p-8 text-coral">Couldn’t load pitch: {error}</p>
      </div>
    );
  }
  if (!pitch) {
    return (
      <div className="ob-screen">
        <PageHeader eyebrow="Events · Pitching" title="Pitch" backHref="/pitching" />
        <p className="p-8 text-stone">Loading…</p>
      </div>
    );
  }

  const stage = pitchStage(pitch.status);

  return (
    <div className="ob-screen pb-10">
      <PageHeader
        eyebrow="Events · Pitching"
        title={pitch.authorName}
        backHref="/pitching"
        compact
        actions={
          <>
            <button onClick={remove} disabled={busy} className={btnDanger}>
              Delete
            </button>
            <Link href={`/pitching/${pitch.id}/edit`} className={btnPrimary}>
              Edit
            </Link>
          </>
        }
      >
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <StageChip raw={pitch.status} />
          <PriorityChip priority={pitch.priority} />
          <RatingStars rating={pitch.rating} />
          {pitch.initialHighPriority && (
            <span className="eyebrow rounded-full border border-rust/30 bg-shell px-2.5 py-1 text-rust">Initial high priority</span>
          )}
        </div>
      </PageHeader>

      <div className="mx-auto grid w-full max-w-[1080px] grid-cols-1 gap-7 px-5 pt-6 sm:px-8 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-lg border border-cream-2 bg-white px-5 py-2">
          <Row k="Book title">{pitch.bookTitle || "—"}</Row>
          <Row k="ISBN">{pitch.isbn ? <span className="font-mono">{pitch.isbn}</span> : "—"}</Row>
          <Row k="Imprint">{pitch.imprintNames.join(", ") || "—"}</Row>
          <Row k="Publisher">
            {pitch.publisherNames.join(", ") || (pitch.imprintNames.length ? "via imprint" : "—")}
            <span className="ml-2 text-[11px] text-stone">read-only — set via imprint</span>
          </Row>
          <Row k="Publication">
            {pitch.publicationDate
              ? new Date(pitch.publicationDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
              : "—"}
          </Row>
          <Row k="Airtable status">
            {pitch.status || "—"}
            {pitch.status && pitch.status !== stage.writeAs && (
              <span className="ml-2 text-[11px] text-stone">shown as “{stage.label}”</span>
            )}
          </Row>
          <Row k="Lead">{pitch.leadName || "—"}</Row>
          <Row k="Publicist">
            {pitch.publicist || "—"}
            {pitch.publicistEmail && (
              <a href={`mailto:${pitch.publicistEmail}`} className="ml-2 text-rust underline">
                {pitch.publicistEmail}
              </a>
            )}
          </Row>
          <Row k="Venue(s)">{pitch.proposedVenueNames.join(", ") || "—"}</Row>
          <Row k="Proposed dates">{pitch.proposedDates || "—"}</Row>
          <Row k="Audience est.">{pitch.estimatedAudienceSize || "—"}</Row>
          <Row k="Shop">{pitch.location ?? "—"}</Row>
          <div className={`${rowCls} border-b-0`}>
            <div className={keyCls}>Added</div>
            <div className="text-charcoal">
              {new Date(pitch.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-5">
          <section className="rounded-lg border border-cream-2 bg-white p-5">
            <h2 className="m-0 text-[17px]">Pitch deck</h2>
            {pitch.pitchDeck.length === 0 && <p className="mb-0 mt-2 text-sm text-stone">Nothing attached yet.</p>}
            <ul className="m-0 mt-2 list-none p-0">
              {pitch.pitchDeck.map((a) => (
                <li key={a.id} className="flex items-center gap-2 border-b border-cream-2 py-2 text-sm last:border-b-0">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 text-stone">
                    <path d="M21 12.5l-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8L13 5a3.7 3.7 0 0 1 5.2 5.2L10 18.4a1.8 1.8 0 0 1-2.6-2.6L15 8.3" />
                  </svg>
                  <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-rust underline">
                    {a.filename}
                  </a>
                  <span className="text-xs text-stone">{fmtSize(a.size)}</span>
                </li>
              ))}
            </ul>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadDeck(e.target.files[0])}
            />
            <button onClick={() => fileRef.current?.click()} disabled={busy} className={`${btnGhost} mt-3`}>
              {busy ? "Uploading…" : "+ Attach file"}
            </button>
            <p className="mb-0 mt-2 text-[11.5px] text-stone">Up to 5MB per file.</p>
          </section>

          <section className="rounded-lg border border-cream-2 bg-white p-5">
            <h2 className="m-0 text-[17px]">Pitching notes</h2>
            <p className="mb-0 mt-2 whitespace-pre-wrap text-sm text-charcoal">{pitch.pitchingNotes || "—"}</p>
          </section>

          <section className="rounded-lg border border-cream-2 bg-white p-5">
            <h2 className="m-0 text-[17px]">Opportunity notes</h2>
            <p className="mb-0 mt-2 whitespace-pre-wrap text-sm text-charcoal">{pitch.opportunityNotes || "—"}</p>
          </section>
        </div>
      </div>

      {error && <p className="mx-auto mt-4 w-full max-w-[1080px] px-5 text-sm font-semibold text-coral sm:px-8">{error}</p>}
    </div>
  );
}
