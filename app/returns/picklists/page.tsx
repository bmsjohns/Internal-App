"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { pickedUnits, returnUnits, routeLabel } from "@/lib/returns";
import { useVenue } from "@/components/VenueContext";
import { useReturnsData } from "@/components/clubs/data";
import { ModuleHeader, venueColor } from "@/components/clubs/ui";
import { LineCover } from "@/components/returns/ui";
import { VENUES } from "@/lib/config";

// Pick lists — approved returns ready to pull and box (spec: barcode point
// 2). Each card shows scan progress; the actual scanning lives on the
// return's detail page so pick state and the timeline stay in one place.

export default function PickListsPage() {
  const router = useRouter();
  const { venue } = useVenue();
  const { data, error } = useReturnsData();

  const cards = useMemo(() => {
    if (!data) return [];
    return data.returns.filter(
      (r) =>
        r.status === "approved" &&
        (venue === "all" || r.location === (venue === "simply" ? "Simply Books" : "Prologue"))
    );
  }, [data, venue]);

  const pubOf = (id: string | null) => data?.publishers.find((p) => p.id === id);

  return (
    <div className="min-h-screen">
      <ModuleHeader
        eyebrow="Returns · approved & ready"
        title="Pick lists"
        subtitle="RA received — pull the physical stock and scan each book off the list to confirm it's boxed. Nothing ships until the pick is complete."
      />

      {error && <p className="px-8 py-10 text-sm font-semibold text-rust">{error}</p>}
      {!error && !data && <p className="px-8 py-10 text-sm text-stone">Loading…</p>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] content-start gap-4 px-4 py-5 sm:px-8">
        {cards.map((r) => {
          const picked = pickedUnits(r);
          const total = returnUnits(r);
          const pct = total ? Math.round((picked / total) * 100) : 0;
          const color = venueColor(r.location);
          const teal = r.location === "Simply Books";
          return (
            <button
              key={r.id}
              onClick={() => router.push(`/returns/${r.id}`)}
              className="flex cursor-pointer flex-col gap-3 rounded-xl border border-cream-2 bg-white p-[18px] text-left shadow-sm transition-colors hover:bg-ink/[0.02]"
              style={{ borderTop: `4px solid ${color}` }}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div>
                  <div className="font-display text-xl leading-none">{pubOf(r.publisherId)?.name ?? "—"}</div>
                  <div className="mt-1 text-xs text-stone">
                    {r.code} · {routeLabel(r.route)}
                  </div>
                </div>
                <span
                  className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ background: teal ? VENUES.simply.color + "1f" : VENUES.prologue.color + "1f", color }}
                >
                  {r.location}
                </span>
              </div>

              <div className="flex gap-1.5">
                {r.lines.slice(0, 5).map((l) => (
                  <LineCover key={l.id} isbn={l.isbn} title={l.title} width={32} height={44} />
                ))}
              </div>

              <div>
                <div className="h-[7px] overflow-hidden rounded-full bg-cream-2">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-charcoal">
                    {picked} / {total} picked
                  </span>
                  <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color }}>
                    {picked >= total && total > 0 ? "Ready to ship" : picked > 0 ? "Resume" : "Start picking"}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                </div>
              </div>
            </button>
          );
        })}

        {data && cards.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center px-5 py-16 text-center">
            <Image src="/assets/bird-reading.png" alt="" width={104} height={104} className="mb-4 h-auto w-[104px] opacity-90" />
            <div className="font-display text-[23px]">No approved returns to pick.</div>
            <p className="mt-1.5 max-w-[340px] text-sm text-charcoal">
              Once a publisher or Gardners issues an RA, the return lands here ready to pull and box.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
