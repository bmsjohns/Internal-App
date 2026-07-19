"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { fetchJson } from "@/lib/fetch-json";

export default function EventEditGate({
  children,
  title,
  backHref,
}: {
  children: React.ReactNode;
  title: string;
  backHref: string;
}) {
  const [canEdit, setCanEdit] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJson<{ canEdit: boolean }>("/api/events/meta")
      .then((meta) => setCanEdit(meta.canEdit))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t check access"));
  }, []);

  if (error || canEdit === false) {
    return (
      <div className="ob-screen min-h-screen">
        <PageHeader eyebrow="Events · read only" title={title} backHref={backHref} />
        <div className="mx-auto max-w-[560px] px-5 pt-16 text-center sm:px-8">
          <div className="font-display text-2xl">Editing access is required.</div>
          <p className="mt-2 text-charcoal">{error || "You can view Events, but you can’t create or change its records."}</p>
        </div>
      </div>
    );
  }
  if (canEdit === null) return <p className="p-8 text-stone">Checking access…</p>;
  return children;
}
