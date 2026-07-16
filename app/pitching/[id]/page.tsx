"use client";

import { use, useEffect, useState } from "react";
import type { Pitch } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import PitchEditor from "@/components/pitching/PitchEditor";

// Single combined detail/edit screen, per the design file — no separate
// read-only view. PitchEditor owns the layout including its own header.
export default function PitchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/pitches/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status === 403 ? "No pitching access" : `HTTP ${r.status}`))))
      .then((d) => setPitch(d.pitch))
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="ob-screen">
        <PageHeader eyebrow="Events · Pitching" title="Pitch" backHref="/pitching" compact />
        <p className="p-8 text-coral">Couldn’t load pitch: {error}</p>
      </div>
    );
  }
  if (!pitch) {
    return (
      <div className="ob-screen">
        <PageHeader eyebrow="Events · Pitching" title="Pitch" backHref="/pitching" compact />
        <p className="p-8 text-stone">Loading…</p>
      </div>
    );
  }
  return <PitchEditor pitch={pitch} />;
}
