"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Pitch, ShowEvent } from "@/lib/types";
import EventEditor, { type EventsMeta } from "@/components/events/EventEditor";
import PageHeader from "@/components/PageHeader";

const blank = (): ShowEvent => ({
  id: "",
  name: "",
  leadTitle: "",
  isbn: "",
  date: "",
  time: "",
  venueId: null,
  venueName: "",
  location: null,
  hostId: null,
  hostName: "",
  types: [],
  ages: [],
  format: "",
  status: "Provisional",
  fromPitchId: null,
  roles: [],
  schedule: [],
  legacyStaffing: [],
  bookTicket: null,
  ticketOnly: null,
  minOrder: null,
  lumaLink: "",
  banners: false,
  callSheet: [],
  callSheetSent: false,
  salesReportSent: false,
  mediaCount: 0,
  notes: "",
  createdAt: "",
});

/**
 * New event — standalone, or "convert from pitch" via ?fromPitch=<id>
 * (spec §1/§5.2: carry over author, title, ISBN and proposed venue; most
 * events start as a pitch but the standalone path stays open).
 */
function NewEventInner() {
  const fromPitch = useSearchParams().get("fromPitch");
  const [initial, setInitial] = useState<ShowEvent | null>(null);
  const [meta, setMeta] = useState<EventsMeta | null>(null);
  const [pitchName, setPitchName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loads: Promise<void>[] = [
      fetch("/api/events/meta").then(async (r) => {
        if (r.status === 403) throw new Error("The Events module needs access — ask Ben.");
        if (!r.ok) throw new Error("Couldn’t load the form.");
        setMeta(await r.json());
      }),
    ];
    if (fromPitch) {
      loads.push(
        fetch(`/api/pitches/${fromPitch}`).then(async (r) => {
          const base = blank();
          if (!r.ok) {
            // No pitching access (or pitch gone) — still allow a standalone event.
            setInitial(base);
            return;
          }
          const { pitch } = (await r.json()) as { pitch: Pitch };
          setPitchName(pitch.authorName);
          setInitial({
            ...base,
            name: pitch.authorName,
            leadTitle: pitch.bookTitle,
            isbn: pitch.isbn,
            venueId: pitch.proposedVenueIds[0] ?? null,
            location: pitch.location,
            fromPitchId: pitch.id,
            notes: [
              pitch.pitchingNotes,
              pitch.publisherNames.length ? `Publisher: ${pitch.publisherNames.join(", ")}` : "",
              pitch.imprintNames.length ? `Imprint: ${pitch.imprintNames.join(", ")}` : "",
            ].filter(Boolean).join("\n\n"),
          });
        })
      );
    } else {
      setInitial(blank());
    }
    Promise.all(loads).catch((e) => setError(e.message));
  }, [fromPitch]);

  if (error) {
    return (
      <div className="ob-screen flex min-h-screen flex-col">
        <PageHeader eyebrow="Events" title="New event" backHref="/events" />
        <p className="p-8 text-charcoal">{error}</p>
      </div>
    );
  }
  if (!initial || !meta) return <p className="p-8 text-stone">Loading…</p>;
  return <EventEditor initial={initial} meta={meta} isNew fromPitchRef={pitchName || undefined} />;
}

export default function NewEventPage() {
  return (
    <Suspense fallback={<p className="p-8 text-stone">Loading…</p>}>
      <NewEventInner />
    </Suspense>
  );
}
