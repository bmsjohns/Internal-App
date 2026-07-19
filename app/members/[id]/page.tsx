"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ClubMembership, PaymentRecord } from "@/lib/types";
import { MEMBERSHIP_STATUS, PAY_STATUS, money } from "@/lib/clubs";
import { useClubsData, post } from "@/components/clubs/data";
import { CancelOverlay, MoveOverlay, PauseOverlay } from "@/components/clubs/MembershipActions";
import { MemberAvatar, Tag, Toast, useAccent, venueColor } from "@/components/clubs/ui";

// Member detail (spec B3): contact info, notes, clubs they're in with
// subscription + payment standing per club, quick actions
// (cancel / pause / resume / move) and read-only payment history. Refunds
// view-only — issued in the Stripe dashboard (B2).
export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { accent } = useAccent();
  const { data, error, refresh } = useClubsData();
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [overlay, setOverlay] = useState<{ kind: "cancel" | "pause" | "move"; sub: ClubMembership } | null>(null);
  const [toast, setToast] = useState("");
  const [notes, setNotes] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);

  const member = data?.members.find((m) => m.id === id);
  const subs = useMemo(() => data?.memberships.filter((s) => s.memberId === id) ?? [], [data, id]);

  useEffect(() => {
    fetch(`/api/clubs/members/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPayments(d?.payments ?? []))
      .catch(() => setPayments([]));
  }, [id]);

  if (error) return <p className="px-8 py-10 text-sm font-semibold text-rust">{error}</p>;
  if (!data || !member)
    return <p className="px-8 py-10 text-sm text-stone">{data ? "Member not found." : "Loading…"}</p>;

  const clubOf = (clubId: string) => data.clubs.find((c) => c.id === clubId);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };
  const done = (msg: string) => {
    setOverlay(null);
    refresh();
    showToast(msg);
  };

  const resume = async (sub: ClubMembership) => {
    try {
      await post("/api/clubs/actions", { action: "resume", membershipId: sub.id });
      refresh();
      showToast("Subscription resumed (logged)");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Resume failed");
    }
  };

  const saveNotes = async () => {
    if (notes == null) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/clubs/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Save failed");
      setNotes(null);
      refresh();
      showToast("Notes saved");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingNotes(false);
    }
  };

  const actionBtn =
    "cursor-pointer rounded-md border-[1.5px] border-cream-2 bg-white px-3 py-1.5 text-xs font-semibold text-charcoal hover:border-ink";

  return (
    <div className="min-h-screen">
      <div className="px-5 pt-5 sm:px-8">
        <Link href="/members" className="-ml-2 inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-[13px] font-semibold text-charcoal hover:bg-ink/5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Members
        </Link>
      </div>
      <header className="px-5 pb-5 pt-3 sm:px-8" style={{ borderBottom: `1.5px solid ${accent}` }}>
        <div className="flex items-center gap-4">
          <MemberAvatar name={member.name} size={60} />
          <div className="min-w-0">
            <h1 className="m-0 text-[28px] leading-none tracking-[-0.02em] sm:text-[34px]">{member.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-charcoal">
              {member.email && <span>{member.email}</span>}
              {member.phone && <span className="tabular-nums">{member.phone}</span>}
              {member.stripeCustomerId && <span className="tabular-nums text-stone">{member.stripeCustomerId}</span>}
            </div>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[1fr_320px]">
        <div>
          <h3 className="m-0 mb-3 font-display text-[22px]">Clubs &amp; subscriptions</h3>
          {subs.length === 0 && <p className="text-sm text-stone">Not in any clubs.</p>}
          {subs.map((s) => {
            const club = clubOf(s.clubId);
            if (!club) return null;
            const vc = venueColor(club.location);
            return (
              <div key={s.id} className="mb-2.5 rounded-[10px] border border-cream-2 bg-white px-4 py-3.5" style={{ borderLeft: `3px solid ${vc}` }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/clubs/${club.id}`} className="font-display text-lg text-ink hover:underline">
                      {club.name}
                    </Link>
                    <div className="mt-0.5 text-xs text-stone">
                      {club.location} · joined {s.joined} · {money(s.amount)}/mo
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag {...MEMBERSHIP_STATUS[s.status]} />
                    {s.payStatus !== "ok" && s.status !== "cancelled" && <Tag {...PAY_STATUS[s.payStatus]} />}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-cream-2 pt-3">
                  <div className="text-xs tabular-nums text-stone">
                    {s.cardLabel} · renews {s.periodEnd} · {s.stripeSubscriptionId}
                  </div>
                  {data.canManage && s.status !== "cancelled" && (
                    <div className="flex gap-1.5">
                      {s.status === "paused" ? (
                        <button onClick={() => resume(s)} className={actionBtn}>
                          Resume
                        </button>
                      ) : (
                        <button onClick={() => setOverlay({ kind: "pause", sub: s })} className={actionBtn}>
                          Pause
                        </button>
                      )}
                      <button onClick={() => setOverlay({ kind: "move", sub: s })} className={actionBtn}>
                        Move
                      </button>
                      <button
                        onClick={() => setOverlay({ kind: "cancel", sub: s })}
                        className="cursor-pointer rounded-md border-[1.5px] border-[#E9C5BE] bg-white px-3 py-1.5 text-xs font-semibold text-rust-deep hover:bg-shell"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                {s.log.length > 0 && (
                  <div className="mt-2 text-[11px] text-stone">
                    Last action: {s.log[s.log.length - 1].action} — {s.log[s.log.length - 1].by},{" "}
                    {new Date(s.log[s.log.length - 1].at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-cream-2 bg-white p-5">
            <div className="eyebrow mb-2 flex items-center justify-between text-stone">
              <span>Notes</span>
              {data.canManage && notes == null && (
                <button onClick={() => setNotes(member.notes)} className="cursor-pointer text-[11px] font-semibold normal-case tracking-normal text-charcoal underline">
                  Edit
                </button>
              )}
            </div>
            {notes == null ? (
              <p className="m-0 text-[13.5px] text-charcoal">
                {member.notes || <span className="text-stone">No notes yet.</span>}
              </p>
            ) : (
              <>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-cream-2 bg-white px-3 py-2 text-[13.5px] text-ink"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button onClick={() => setNotes(null)} className={actionBtn}>
                    Discard
                  </button>
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="cursor-pointer rounded-md border-[1.5px] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: accent, borderColor: accent }}
                  >
                    Save
                  </button>
                </div>
              </>
            )}
            {member.address && (
              <div className="mt-3.5 border-t border-cream-2 pt-3.5">
                <div className="mb-1 text-[11px] uppercase tracking-[0.1em] text-stone">Address</div>
                <div className="text-[13px] text-charcoal">{member.address}</div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-cream-2 bg-white p-5">
            <div className="eyebrow mb-1.5 text-stone">Payment history</div>
            {payments == null && <p className="py-1 text-sm text-stone">Loading…</p>}
            {payments?.length === 0 && <p className="py-1 text-sm text-stone">No payments recorded.</p>}
            {(payments ?? []).slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-cream-2 py-2 text-[13px] last:border-b-0">
                <span className="text-charcoal">
                  {new Date(p.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  <span className="ml-1.5 text-[11px] text-stone">{p.description}</span>
                </span>
                <span className={`font-semibold ${p.status === "succeeded" ? "text-[#2E6B4F]" : "text-rust-deep"}`}>
                  {p.status === "succeeded" ? money(p.amount) : p.status === "refunded" ? "Refunded" : "Failed"}
                </span>
              </div>
            ))}
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-stone">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <path d="M15 3h6v6M10 14L21 3" />
              </svg>
              Refunds are view-only — issue in the Stripe dashboard
            </div>
          </div>
        </div>
      </div>

      {overlay?.kind === "cancel" && clubOf(overlay.sub.clubId) && (
        <CancelOverlay membership={overlay.sub} member={member} club={clubOf(overlay.sub.clubId)!} onClose={() => setOverlay(null)} onDone={done} />
      )}
      {overlay?.kind === "pause" && clubOf(overlay.sub.clubId) && (
        <PauseOverlay membership={overlay.sub} member={member} club={clubOf(overlay.sub.clubId)!} onClose={() => setOverlay(null)} onDone={done} />
      )}
      {overlay?.kind === "move" && (
        <MoveOverlay membership={overlay.sub} member={member} clubs={data.clubs} onClose={() => setOverlay(null)} onDone={done} />
      )}
      {toast && <Toast text={toast} />}
    </div>
  );
}
