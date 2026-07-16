"use client";

import { use, useEffect, useState } from "react";
import type { Pitch } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import PitchForm from "@/components/pitching/PitchForm";

export default function EditPitch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/pitches/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status === 403 ? "No pitching access" : `HTTP ${r.status}`))))
      .then((d) => setPitch(d.pitch))
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <div className="ob-screen">
      <PageHeader
        eyebrow="Events · Pitching"
        title={pitch ? `Edit · ${pitch.authorName}` : "Edit pitch"}
        backHref={`/pitching/${id}`}
        compact
      />
      {error && <p className="p-8 text-coral">Couldn’t load pitch: {error}</p>}
      {!pitch && !error && <p className="p-8 text-stone">Loading…</p>}
      {pitch && <PitchForm pitch={pitch} />}
    </div>
  );
}
