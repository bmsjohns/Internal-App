"use client";

import { use, useEffect, useState } from "react";
import type { ShowEvent } from "@/lib/types";
import EventEditor, { type EventsMeta } from "@/components/events/EventEditor";
import PageHeader from "@/components/PageHeader";

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [event, setEvent] = useState<ShowEvent | null>(null);
  const [meta, setMeta] = useState<EventsMeta | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetch(`/api/events/${id}`), fetch("/api/events/meta")])
      .then(async ([er, mr]) => {
        if (er.status === 403 || mr.status === 403) throw new Error("The Events module needs access — ask Ben.");
        if (er.status === 404) throw new Error("Event not found.");
        if (!er.ok || !mr.ok) throw new Error("Couldn’t load the event.");
        const [ed, md] = await Promise.all([er.json(), mr.json()]);
        setEvent(ed.event);
        setMeta(md);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="ob-screen flex min-h-screen flex-col">
        <PageHeader eyebrow="Events" title="Event" backHref="/events" />
        <p className="p-8 text-charcoal">{error}</p>
      </div>
    );
  }
  if (!event || !meta) {
    return (
      <div className="ob-screen flex min-h-screen flex-col">
        <div className="border-b-[1.5px] border-rust px-5 pb-[18px] pt-[26px] sm:px-8">
          <div className="eyebrow mb-1.5 text-rust">Event</div>
          <div className="h-[26px] w-64 animate-pulse rounded bg-cream-2" />
        </div>
        <div className="flex flex-col gap-3 p-5 sm:p-8">
          <div className="h-40 animate-pulse rounded-lg bg-white" />
          <div className="h-24 animate-pulse rounded-lg bg-white" />
        </div>
      </div>
    );
  }
  return <EventEditor initial={event} meta={meta} isNew={false} />;
}
