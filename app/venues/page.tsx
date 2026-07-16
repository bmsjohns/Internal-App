"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Venue } from "@/lib/types";
import PageHeader, { btnPrimary } from "@/components/PageHeader";

const MAP_PIN = (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export default function VenuesPage() {
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/venues")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status === 403 ? "The Events module needs access — ask Ben." : `HTTP ${r.status}`))))
      .then((d) => setVenues(d.venues))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      <PageHeader
        eyebrow="Events · Phase 2"
        title="Venues"
        actions={
          <Link href="/venues/new" className={btnPrimary}>
            + New venue
          </Link>
        }
      >
        <p className="mb-0 mt-1.5 max-w-[560px] text-[13.5px] text-charcoal">
          Where events happen — our own spaces and hired-in rooms.
        </p>
      </PageHeader>
      <div className="flex-1 overflow-auto px-4 pb-10 pt-6 sm:px-8">
        {error && <p className="text-sm font-semibold text-coral">{error}</p>}
        {!venues && !error && <p className="text-stone">Loading…</p>}
        {venues && (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {venues.map((v) => (
              <button
                key={v.id}
                onClick={() => router.push(`/venues/${v.id}`)}
                className="cursor-pointer overflow-hidden rounded-lg border border-cream-2 bg-white text-left transition-colors hover:bg-shell/40"
              >
                {v.photo[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Airtable attachment URLs are short-lived; next/image caching fights them
                  <img src={v.photo[0].url} alt="" className="h-[120px] w-full border-b border-cream-2 object-cover" />
                ) : (
                  <div className="flex h-[120px] items-center justify-center border-b border-cream-2 bg-shell text-blush">{MAP_PIN}</div>
                )}
                <div className="px-4 py-[15px]">
                  <div className="mb-2 flex items-start justify-between gap-2.5">
                    <div className="font-display text-base leading-tight">{v.name}</div>
                    {v.status && (
                      <span className="shrink-0 rounded-full border border-cream-2 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-stone">
                        {v.status}
                      </span>
                    )}
                  </div>
                  <div className="mb-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-stone">
                    {v.capacity && <span>Cap. {v.capacity}</span>}
                    {v.locations.length > 0 && <span>{v.locations.join(", ")}</span>}
                    <span>
                      {v.eventIds.length} event{v.eventIds.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {v.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {v.tags.map((t) => (
                        <span key={t} className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-charcoal">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
