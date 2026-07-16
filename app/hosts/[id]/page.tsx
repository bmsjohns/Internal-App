"use client";

import { use, useEffect, useState } from "react";
import type { Host } from "@/lib/types";
import HostEditor from "@/components/events/HostEditor";
import PageHeader from "@/components/PageHeader";

export default function HostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [host, setHost] = useState<Host | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/hosts/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status === 404 ? "Host not found." : "Couldn’t load the host."))))
      .then((d) => setHost(d.host))
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="ob-screen flex min-h-screen flex-col">
        <PageHeader eyebrow="Events" title="Host" backHref="/hosts" />
        <p className="p-8 text-charcoal">{error}</p>
      </div>
    );
  }
  if (!host) return <p className="p-8 text-stone">Loading…</p>;
  return <HostEditor initial={host} />;
}
