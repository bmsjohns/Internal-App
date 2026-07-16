"use client";

import { use, useEffect, useState } from "react";
import type { Venue } from "@/lib/types";
import VenueEditor from "@/components/events/VenueEditor";
import PageHeader from "@/components/PageHeader";

export default function VenueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/venues/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status === 404 ? "Venue not found." : "Couldn’t load the venue."))))
      .then((d) => setVenue(d.venue))
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="ob-screen flex min-h-screen flex-col">
        <PageHeader eyebrow="Events" title="Venue" backHref="/venues" />
        <p className="p-8 text-charcoal">{error}</p>
      </div>
    );
  }
  if (!venue) return <p className="p-8 text-stone">Loading…</p>;
  return <VenueEditor initial={venue} />;
}
