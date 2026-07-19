"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { HubLine, Location } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";
import { HUB_SOURCES, costEach, draftAgeDays, isStaleDraft, rateFor } from "@/lib/hub";
import { money } from "@/lib/clubs";
import { useVenue } from "@/components/VenueContext";
import { post, useHubData } from "@/components/clubs/data";
import { ModuleHeader, SourceBadge, Toast, useAccent, venueColor } from "@/components/clubs/ui";

// Staging — Flow A (spec C2). Nothing enters the hub automatically: every
// source stages a draft here for review. Quantity edits are inline and fast,
// account assignment is mandatory with NO default, drafts persist forever
// but go visibly stale after 7 days, deletes are logged and never touch the
// originating record.
export default function StagingPage() {
  const { venue } = useVenue();
  const { accent } = useAccent();
  const { data, error, refresh } = useHubData();
  const [toast, setToast] = useState("");
  const [busyKey, setBusyKey] = useState("");
  // Optimistic quantity edits so steppers feel instant.
  const [qtyEdits, setQtyEdits] = useState<Record<string, number>>({});

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  const drafts = useMemo(() => {
    if (!data) return [];
    const lines = data.lines.filter(
      (l) =>
        l.state === "draft" &&
        (venue === "all" || l.account == null || l.account === (venue === "simply" ? "Simply Books" : "Prologue"))
    );
    const groups = new Map<string, HubLine[]>();
    for (const l of lines) {
      const key = l.draftKey ?? l.id;
      groups.set(key, [...(groups.get(key) ?? []), l]);
    }
    return [...groups.entries()]
      .map(([key, ls]) => ({ key, lines: ls, first: ls[0] }))
      .sort((a, b) => (a.first.createdAt < b.first.createdAt ? 1 : -1));
  }, [data, venue]);

  const pubOf = (id: string | null) => data?.publishers.find((p) => p.id === id);
  const qtyOf = (l: HubLine) => qtyEdits[l.id] ?? l.quantity;

  const setQty = async (l: HubLine, qty: number) => {
    const n = Math.max(0, Math.floor(qty) || 0);
    setQtyEdits((e) => ({ ...e, [l.id]: n }));
    try {
      await post("/api/hub/drafts", { action: "updateLine", lineId: l.id, quantity: n });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Quantity update failed");
      setQtyEdits((edits) => {
        const rest = { ...edits };
        delete rest[l.id];
        return rest;
      });
    }
  };

  const setAccount = async (key: string, account: Location) => {
    setBusyKey(key);
    try {
      await post("/api/hub/drafts", { action: "setAccount", draftKey: key, account });
      refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyKey("");
    }
  };

  const del = async (key: string) => {
    setBusyKey(key);
    try {
      await post("/api/hub/drafts", { action: "delete", draftKey: key });
      refresh();
      showToast("Draft deleted (logged) — source record untouched");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyKey("");
    }
  };

  const push = async (key: string) => {
    setBusyKey(key);
    try {
      await post("/api/hub/drafts", { action: "push", draftKey: key });
      refresh();
      showToast("Pushed to hub — now in the pending queue");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Push failed");
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="min-h-screen">
      <ModuleHeader
        eyebrow="Ordering hub · flow A"
        title="Staging"
        subtitle="Every source stages a draft here. Review quantities, assign an account, then push to the hub. Drafts never expire — nothing is discarded silently."
      />
      {error && <p className="px-8 py-10 text-sm font-semibold text-rust">{error}</p>}
      {!error && !data && <p className="px-8 py-10 text-sm text-stone">Loading…</p>}

      <div className="flex flex-col gap-4 px-4 py-5 sm:px-8">
        {drafts.map(({ key, lines, first }) => {
          const src = HUB_SOURCES[first.source];
          const stale = lines.some((l) => isStaleDraft(l));
          const account = first.account;
          const total = lines.reduce((sum, l) => {
            const each = costEach(l.rrp, rateFor(pubOf(l.publisherId), l.orderType, l.account));
            return sum + (each == null ? 0 : each * qtyOf(l));
          }, 0);
          const busy = busyKey === key;
          return (
            <div key={key} className="overflow-hidden rounded-[14px] border border-cream-2 bg-white shadow-sm">
              {/* head */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cream-2 px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <SourceBadge {...src} />
                  <div>
                    <div className="font-display text-[19px] leading-tight">
                      {first.sourceLabel.replace(/^(Book Club|Event|School|Customer order) — /, "")}
                    </div>
                    <div className="mt-0.5 text-xs text-stone">
                      {first.sourceLabel} · staged{" "}
                      {new Date(first.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  {stale && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E9D8AE] bg-[#FBF1DA] px-2.5 py-1.5 text-xs font-semibold text-ochre">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                      </svg>
                      Sitting {draftAgeDays(first.createdAt)} days
                    </span>
                  )}
                  <button
                    onClick={() => del(key)}
                    disabled={busy}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-[1.5px] border-cream-2 bg-transparent px-3 py-2 text-[13px] font-semibold text-stone hover:border-ink hover:text-ink disabled:opacity-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>

              {/* account assignment — mandatory, no default (C2) */}
              <div className="flex flex-wrap items-center gap-3 border-b border-cream-2 bg-cream px-4 py-3 sm:px-5">
                <span className="eyebrow text-charcoal">Assign to account</span>
                <div className="flex gap-1.5">
                  {LOCATIONS.map((loc) => {
                    const active = account === loc;
                    const dot = venueColor(loc);
                    return (
                      <button
                        key={loc}
                        onClick={() => setAccount(key, loc)}
                        disabled={busy}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-[7px] text-[12.5px] font-semibold disabled:opacity-60"
                        style={
                          active
                            ? { borderColor: dot, background: dot, color: "#fff" }
                            : { borderColor: "var(--color-cream-2)", background: "#fff", color: "var(--color-charcoal)" }
                        }
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: active ? "#fff" : dot }} />
                        {loc}
                      </button>
                    );
                  })}
                </div>
                {!account && <span className="text-xs font-semibold text-coral">Required before pushing</span>}
              </div>

              {/* lines — the reviewer sees real money, not just quantities (C2) */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13.5px]">
                  <thead>
                    <tr className="eyebrow text-left text-stone">
                      <th className="py-2.5 pl-4 pr-3 font-semibold sm:pl-5">Title / ISBN</th>
                      <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Publisher</th>
                      <th className="hidden px-3 py-2.5 text-right font-semibold md:table-cell">RRP</th>
                      <th className="hidden px-3 py-2.5 text-right font-semibold md:table-cell">Disc.</th>
                      <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Cost ea.</th>
                      <th className="px-3 py-2.5 text-center font-semibold">Qty</th>
                      <th className="py-2.5 pl-3 pr-4 text-right font-semibold sm:pr-5">Line cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const pub = pubOf(l.publisherId);
                      const rate = rateFor(pub, l.orderType, l.account);
                      const each = costEach(l.rrp, rate);
                      const qty = qtyOf(l);
                      return (
                        <tr key={l.id} className="border-t border-cream-2">
                          <td className="py-2.5 pl-4 pr-3 sm:pl-5">
                            <div className="font-semibold">{l.title}</div>
                            <div className="text-xs tabular-nums text-stone">{l.isbn || "ISBN TBC"}</div>
                          </td>
                          <td className="hidden px-3 py-2.5 text-charcoal sm:table-cell">
                            {pub?.name ?? <span className="text-stone">Not set</span>}
                            {l.imprint && <div className="text-[11px] text-stone">{l.imprint}</div>}
                          </td>
                          <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">{l.rrp != null ? money(l.rrp) : "—"}</td>
                          <td className="hidden px-3 py-2.5 text-right tabular-nums text-stone md:table-cell">{rate != null ? `${rate}%` : "—"}</td>
                          <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell">{each != null ? money(each) : "—"}</td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="inline-flex items-center overflow-hidden rounded-md border border-cream-2 bg-white">
                              <button onClick={() => setQty(l, qty - 1)} className="cursor-pointer border-none bg-transparent px-2.5 py-1.5 text-[15px] text-charcoal hover:bg-cream">
                                –
                              </button>
                              <input
                                value={qty}
                                onChange={(e) => setQty(l, Number(e.target.value.replace(/\D/g, "")) || 0)}
                                className="w-[42px] border-x border-cream-2 bg-white py-1.5 text-center text-sm tabular-nums"
                                inputMode="numeric"
                              />
                              <button onClick={() => setQty(l, qty + 1)} className="cursor-pointer border-none bg-transparent px-2.5 py-1.5 text-[15px] text-charcoal hover:bg-cream">
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 pl-3 pr-4 text-right font-semibold tabular-nums sm:pr-5">
                            {each != null ? money(each * qty) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* foot */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cream-2 bg-cream px-4 py-3.5 sm:px-5">
                <div className="text-[12.5px] text-stone">
                  {lines.length} line{lines.length === 1 ? "" : "s"} · batch total{" "}
                  <strong className="tabular-nums text-ink">{money(total)}</strong>
                </div>
                <button
                  onClick={() => push(key)}
                  disabled={!account || busy}
                  title={!account ? "Assign an account first" : undefined}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded border-[1.5px] px-4 py-2.5 text-[13px] font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
                  style={{ background: accent, borderColor: accent }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                  Push to hub
                </button>
              </div>
            </div>
          );
        })}

        {data && drafts.length === 0 && (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <Image src="/assets/bird-delivering-book.png" alt="" width={110} height={110} className="mb-4 h-auto w-[110px] opacity-90" />
            <div className="font-display text-[23px]">No drafts waiting.</div>
            <p className="mt-1.5 max-w-[340px] text-sm text-charcoal">
              New book-club picks, event stock, and school requests land here first.
            </p>
          </div>
        )}
      </div>
      {toast && <Toast text={toast} />}
    </div>
  );
}
