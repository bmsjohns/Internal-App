"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ReturnRequest } from "@/lib/types";
import {
  conditionLabel,
  estimatedCredit,
  groupStaging,
  reasonLabel,
  returnAccountNumber,
  returnUnits,
} from "@/lib/returns";
import { money } from "@/lib/clubs";
import { useVenue } from "@/components/VenueContext";
import { post, useReturnsData } from "@/components/clubs/data";
import { AccentButton, ModuleHeader, Toast, useAccent } from "@/components/clubs/ui";
import { GhostButton, LineCover, OriginPill } from "@/components/returns/ui";

// To be returned — the staging view (spec open question, answered: yes, it
// gets its own page; same mental model as the Hub's staging). Itemised
// requests waiting to be sent for authorisation, grouped publisher ×
// location so requests to the same rep can share one RA. Simply Books and
// Prologue never combine.

export default function ReturnsStagingPage() {
  const router = useRouter();
  const { venue } = useVenue();
  const { accent, accentSoft } = useAccent();
  const { data, error, refresh } = useReturnsData();
  const [toast, setToast] = useState("");
  const [busyId, setBusyId] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  const groups = useMemo(() => {
    if (!data) return [];
    const visible = data.returns.filter(
      (r) => venue === "all" || r.location === (venue === "simply" ? "Simply Books" : "Prologue")
    );
    return groupStaging(visible);
  }, [data, venue]);

  const pubOf = (id: string | null) => data?.publishers.find((p) => p.id === id);

  const act = async (id: string, body: Record<string, unknown>, done?: string) => {
    setBusyId(id);
    try {
      await post("/api/returns", body);
      refresh();
      if (done) showToast(done);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId("");
    }
  };

  const submitAll = async (requests: ReturnRequest[]) => {
    const ready = requests.filter((r) => r.route);
    const blocked = requests.length - ready.length;
    setBusyId("all");
    try {
      for (const r of ready) await post("/api/returns", { action: "submit", id: r.id });
      refresh();
      showToast(blocked > 0 ? `${blocked} still need a route` : `${ready.length} submitted for approval`);
    } catch (e) {
      refresh();
      showToast(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusyId("");
    }
  };

  const routeChip = (r: ReturnRequest, key: "direct" | "gardners", label: string) => {
    const active = r.route === key;
    return (
      <button
        key={key}
        onClick={() => act(r.id, { action: "setRoute", id: r.id, route: key })}
        disabled={busyId === r.id}
        className={`inline-flex cursor-pointer items-center whitespace-nowrap rounded-full border px-3 py-[7px] text-[12.5px] font-semibold disabled:opacity-60 ${
          active ? "text-white" : "bg-white text-charcoal"
        }`}
        style={active ? { background: accent, borderColor: accent } : { borderColor: "var(--color-cream-2)" }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen">
      <ModuleHeader
        eyebrow="Returns · staging"
        title="To be returned"
        subtitle={
          <>
            Itemised requests waiting to be sent for authorisation. Grouped by <strong>publisher × shop</strong> so
            requests to the same rep can share one RA. Simply Books and Prologue never combine.
          </>
        }
        actions={
          <AccentButton onClick={() => router.push("/returns/new")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New return
          </AccentButton>
        }
      />

      {error && <p className="px-8 py-10 text-sm font-semibold text-rust">{error}</p>}
      {!error && !data && <p className="px-8 py-10 text-sm text-stone">Loading…</p>}

      <div className="flex flex-col gap-5 px-4 py-5 sm:px-8">
        {groups.map((g) => {
          const pub = pubOf(g.publisherId);
          const acct = returnAccountNumber(g.requests[0], pub);
          return (
            <div key={g.key}>
              <div className="mb-2.5 flex flex-wrap items-center gap-3">
                <span className="font-display text-[21px] leading-none">{pub?.name ?? "Unknown publisher"}</span>
                <span
                  className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold tabular-nums"
                  style={{ background: accentSoft, color: accent }}
                >
                  {acct || "No account no."}
                </span>
                <span className="text-[12.5px] text-stone">
                  {g.location} · {g.requests.length} request{g.requests.length === 1 ? "" : "s"}
                </span>
                {g.requests.length > 1 && (
                  <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: accentSoft, color: accent }}>
                    Can share one RA
                  </span>
                )}
                <span className="flex-1" />
                {g.requests.length > 1 && (
                  <GhostButton onClick={() => submitAll(g.requests)} disabled={busyId === "all"}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12l16-8-6 16-3-6z" />
                    </svg>
                    Submit all ({g.requests.length})
                  </GhostButton>
                )}
              </div>

              {g.requests.map((r) => (
                <div
                  key={r.id}
                  className="mb-3 overflow-hidden rounded-xl border border-cream-2 bg-white shadow-sm"
                  style={{ borderLeft: "4px solid #6E665C" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cream-2 px-4 py-3.5 sm:px-[18px]">
                    <div className="flex items-center gap-3">
                      <OriginPill r={r} />
                      <div>
                        <div className="font-display text-lg leading-tight">{r.code}</div>
                        <div className="mt-0.5 text-xs text-stone">
                          {r.origin === "event"
                            ? `Event · ${r.eventRef}${r.verifiedBy ? ` · verified ${r.verifiedBy}` : ""}`
                            : `Flagged by ${r.requestedBy}`}
                          {" · "}
                          {new Date(r.dateRequested + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </div>
                      </div>
                    </div>
                    <GhostButton onClick={() => act(r.id, { action: "discard", id: r.id }, "Request discarded")} disabled={busyId === r.id}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                        <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
                      </svg>
                      Discard
                    </GhostButton>
                  </div>

                  <div className="flex flex-wrap items-center gap-3.5 border-b border-cream-2 bg-cream px-4 py-3 sm:px-[18px]">
                    <span className="eyebrow text-charcoal">Return route</span>
                    <div className="flex gap-1.5">
                      {routeChip(r, "direct", "Direct to publisher")}
                      {routeChip(r, "gardners", "Via Gardners")}
                    </div>
                    {!r.route && <span className="text-xs font-semibold text-coral">Choose a route before submitting</span>}
                    {r.route === "gardners" && (
                      <span className="text-xs text-stone">
                        Gardners issues one consolidated authorisation — books ship to Gardners, not the publisher.
                      </span>
                    )}
                    {r.route === "direct" && pub && (
                      <span className="text-xs text-stone">RA comes from {pub.repName} at {pub.name}.</span>
                    )}
                  </div>

                  <table className="w-full border-collapse text-[13.5px]">
                    <tbody>
                      {r.lines.map((l) => (
                        <tr key={l.id} className="border-t border-cream-2 first:border-t-0">
                          <td className="w-[52px] py-2.5 pl-4 pr-3 sm:pl-[18px]">
                            <LineCover isbn={l.isbn} title={l.title} />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold">{l.title}</div>
                            <div className="text-xs tabular-nums text-stone">{l.isbn || "No ISBN"}</div>
                          </td>
                          <td className="hidden px-3 py-2.5 text-xs text-stone sm:table-cell">
                            {l.reason ? reasonLabel(l.reason) : ""}
                            {l.condition ? ` · ${conditionLabel(l.condition)}` : ""}
                          </td>
                          <td className="whitespace-nowrap py-2.5 pl-3 pr-4 text-right font-semibold tabular-nums sm:pr-[18px]">
                            × {l.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cream-2 bg-cream px-4 py-3 sm:px-[18px]">
                    <div className="text-[12.5px] text-stone">
                      {r.lines.length} title{r.lines.length === 1 ? "" : "s"} · {returnUnits(r)} units · est. credit{" "}
                      <strong className="tabular-nums text-ink">{money(estimatedCredit(r, pub))}</strong>
                    </div>
                    <AccentButton
                      onClick={() => act(r.id, { action: "submit", id: r.id }, `${r.code} submitted — awaiting RA`)}
                      disabled={!r.route || busyId === r.id}
                      title={!r.route ? "Choose a route first" : undefined}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12l16-8-6 16-3-6z" />
                      </svg>
                      Submit for approval
                    </AccentButton>
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {data && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <Image src="/assets/bird-delivering-book.png" alt="" width={110} height={110} className="mb-4 h-auto w-[110px] opacity-90" />
            <div className="font-display text-[23px]">Nothing waiting to return.</div>
            <p className="mt-1.5 max-w-[360px] text-sm text-charcoal">
              Flag slow-moving or damaged stock, or let post-event reconciliation queue unsold copies here.
            </p>
            <div className="mt-4">
              <AccentButton onClick={() => router.push("/returns/new")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New return
              </AccentButton>
            </div>
          </div>
        )}
      </div>
      {toast && <Toast text={toast} />}
    </div>
  );
}
