"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { batchPending, HUB_SOURCES } from "@/lib/hub";
import { money } from "@/lib/clubs";
import { useVenue } from "@/components/VenueContext";
import { useHubData } from "@/components/clubs/data";
import ComposeOverlay from "@/components/hub/ComposeOverlay";
import { ModuleHeader, SourceBadge, Toast, venueColor } from "@/components/clubs/ui";

// Pending queue — Flow B (spec C3). Live orders auto-grouped into sendable
// batches by publisher × ACCOUNT (never combined across accounts); lines
// from different sources DO merge into one email — the whole reason the hub
// exists.
export default function PendingPage() {
  const router = useRouter();
  const { venue } = useVenue();
  const { data, error, refresh } = useHubData();
  const [pubFilter, setPubFilter] = useState<string>("all");
  const [composing, setComposing] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const batches = useMemo(() => {
    if (!data) return [];
    let lines = data.lines.filter((l) => l.state === "pending");
    if (venue !== "all") lines = lines.filter((l) => l.account === (venue === "simply" ? "Simply Books" : "Prologue"));
    if (pubFilter !== "all") lines = lines.filter((l) => l.publisherId === pubFilter);
    return batchPending(lines, data.publishers).sort((a, b) => b.total - a.total);
  }, [data, venue, pubFilter]);

  const pubsInPlay = useMemo(() => {
    const ids = new Set(
      (data?.lines ?? [])
        .filter((l) => l.state === "pending")
        .map((l) => l.publisherId)
        .filter((x): x is string => !!x)
    );
    return (data?.publishers ?? []).filter((p) => ids.has(p.id));
  }, [data]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const composingBatch = batches.find((b) => b.key === composing) ?? null;

  const chip = (active: boolean) =>
    active
      ? "border-ink bg-ink text-white"
      : "border-cream-2 bg-white text-charcoal hover:border-ink";

  return (
    <div className="min-h-screen">
      <ModuleHeader
        eyebrow="Ordering hub · flow B"
        title="Pending queue"
        subtitle={
          <>
            Live orders grouped into sendable batches by <strong>publisher × account</strong>. Lines from different
            sources to the same rep on the same account merge into one email — the whole reason the hub exists.
          </>
        }
      >
        <div className="flex flex-wrap gap-1.5 pb-4">
          <button onClick={() => setPubFilter("all")} className={`cursor-pointer rounded-full border px-3.5 py-[7px] text-[12.5px] font-semibold ${chip(pubFilter === "all")}`}>
            All publishers
          </button>
          {pubsInPlay.map((p) => (
            <button key={p.id} onClick={() => setPubFilter(pubFilter === p.id ? "all" : p.id)} className={`cursor-pointer rounded-full border px-3.5 py-[7px] text-[12.5px] font-semibold ${chip(pubFilter === p.id)}`}>
              {p.name}
            </button>
          ))}
        </div>
      </ModuleHeader>

      {error && <p className="px-8 py-10 text-sm font-semibold text-rust">{error}</p>}
      {!error && !data && <p className="px-8 py-10 text-sm text-stone">Loading…</p>}

      <div className="flex flex-col gap-3.5 px-4 py-5 sm:px-8">
        {batches.map((b) => {
          const pub = data!.publishers.find((p) => p.id === b.publisherId);
          const vc = venueColor(b.account);
          return (
            <div key={b.key} className="overflow-hidden rounded-xl border border-cream-2 bg-white shadow-sm" style={{ borderLeft: `4px solid ${vc}` }}>
              <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-display text-[21px] leading-none">{pub?.name ?? "Unknown publisher"}</span>
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: vc }}>
                      {b.account}
                    </span>
                  </div>
                  <div className="mt-1 text-[12.5px] text-stone">
                    {b.lines.length} line{b.lines.length === 1 ? "" : "s"} from {b.sources.length} source
                    {b.sources.length > 1 ? "s" : ""}
                    {pub?.repName ? ` · ${pub.repName}` : ""} · acct {b.accountNumber || "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="mr-1 text-right">
                    <div className="eyebrow text-stone">Batch total</div>
                    <div className="font-display text-xl tabular-nums">{money(b.total)}</div>
                  </div>
                  <button
                    onClick={() => setComposing(b.key)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded border-[1.5px] px-4 py-2.5 text-[13px] font-semibold text-white hover:brightness-95"
                    style={{ background: vc, borderColor: vc }}
                  >
                    {b.blocked ? "Fix & review" : "Review & send"}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </div>
              {b.blocked && (
                <div className="flex items-center gap-2 border-t border-[#E9C5BE] bg-[#FBEAE7] px-4 py-2.5 text-[12.5px] font-semibold text-rust-deep sm:px-5">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                  </svg>
                  Missing {b.account} account number — add it in Publishers before sending
                </div>
              )}
              <div className="border-t border-cream-2 bg-cream">
                {b.lines.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 border-t border-cream-2 px-4 py-2.5 text-[13px] first:border-t-0 sm:px-5">
                    <SourceBadge {...HUB_SOURCES[l.source]} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{l.title}</span>
                    <span className="hidden text-xs tabular-nums text-stone sm:inline">{l.isbn}</span>
                    <span className="tabular-nums text-charcoal">×{l.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {data && batches.length === 0 && (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <Image src="/assets/bird-perched.png" alt="" width={104} height={104} className="mb-4 h-auto w-[104px] opacity-90" />
            <div className="font-display text-[23px]">Queue&rsquo;s clear.</div>
            <p className="mt-1.5 max-w-[320px] text-sm text-charcoal">
              Nothing pending for this filter. Push a draft from Staging to build a batch.
            </p>
          </div>
        )}
      </div>

      {composingBatch && data && (
        <ComposeOverlay
          batch={composingBatch}
          publisher={data.publishers.find((p) => p.id === composingBatch.publisherId)}
          userName={data.userName}
          canSend={data.canSend}
          onClose={() => setComposing(null)}
          onSent={(msg) => {
            setComposing(null);
            refresh();
            showToast(msg);
          }}
          onGoPublishers={() => router.push("/ordering/publishers")}
        />
      )}
      {toast && <Toast text={toast} />}
    </div>
  );
}
