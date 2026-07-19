"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MembershipStatus } from "@/lib/types";
import { CLUB_STATUS, MEMBERSHIP_STATUS, monthLabel, money, currentMonthKey, PAY_STATUS } from "@/lib/clubs";
import { HUB_STATES } from "@/lib/hub";
import SelectionOverlay from "@/components/clubs/SelectionOverlay";
import { useClubsData } from "@/components/clubs/data";
import { MemberAvatar, Tag, Toast, venueColor } from "@/components/clubs/ui";

// Member list defaults to Active + Paused — Cancelled is available but
// hidden until asked for, so the list reads as "who's actually in the club".
const STATUS_FILTERS: { key: MembershipStatus; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "cancelled", label: "Cancelled" },
];

// Club detail (spec B3): member list with subscription + payment status,
// meeting info, this month's pick (status REFLECTED from its hub order) and
// selection history. Avatar cluster per the design.
export default function ClubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, error, refresh } = useClubsData();
  const [picking, setPicking] = useState(false);
  const [toast, setToast] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<MembershipStatus>>(new Set(["active", "paused"]));

  const club = data?.clubs.find((c) => c.id === id);
  const subs = useMemo(() => data?.memberships.filter((s) => s.clubId === id) ?? [], [data, id]);
  const filteredSubs = useMemo(() => subs.filter((s) => statusFilter.has(s.status)), [subs, statusFilter]);
  const active = subs.filter((s) => s.status === "active");
  const toggleStatusFilter = (key: MembershipStatus) =>
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const month = currentMonthKey();
  const selections = useMemo(
    () => (data?.selections.filter((s) => s.clubId === id) ?? []).sort((a, b) => (a.month < b.month ? 1 : -1)),
    [data, id]
  );
  const sel = selections.find((s) => s.month === month) ?? null;
  const teal = club?.location === "Simply Books";

  if (error) return <p className="px-8 py-10 text-sm font-semibold text-rust">{error}</p>;
  if (!data || !club) return <p className="px-8 py-10 text-sm text-stone">{data ? "Club not found." : "Loading…"}</p>;

  const vc = venueColor(club.location);
  const soft = teal ? "#E4F0EC" : "#FBEDEA";
  const memberOf = (memberId: string) => data.members.find((m) => m.id === memberId);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  return (
    <div className="min-h-screen">
      <div className="px-5 pt-5 sm:px-8">
        <Link href="/clubs" className="-ml-2 inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-[13px] font-semibold text-charcoal hover:bg-ink/5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          All clubs
        </Link>
      </div>
      <header className="px-5 pb-5 pt-3 sm:px-8" style={{ borderBottom: `1.5px solid ${vc}` }}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="eyebrow mb-1.5" style={{ color: vc }}>
              {club.location} · {club.genre}
            </div>
            <h1 className="m-0 text-[32px] leading-none tracking-[-0.02em] sm:text-[38px]">{club.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-charcoal">
              <span className="inline-flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="17" rx="2" />
                  <path d="M3 9h18M8 2v4M16 2v4" />
                </svg>
                {club.cadence}
              </span>
              <span className="tabular-nums">
                {active.length} active{club.memberCapacity != null ? ` · capacity ${club.memberCapacity}` : ""}
              </span>
              <Tag {...CLUB_STATUS[club.status]} />
              {club.stripePriceId && <span className="tabular-nums text-stone">Stripe {club.stripePriceId}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex">
              {active.slice(0, 7).map((s, i) => {
                const m = memberOf(s.memberId);
                return m ? (
                  <span key={s.id} style={{ marginLeft: i ? -12 : 0 }}>
                    <MemberAvatar name={m.name} size={38} teal={teal} ring />
                  </span>
                ) : null;
              })}
              {active.length > 7 && (
                <span className="-ml-3 inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 border-cream bg-white text-xs font-semibold text-charcoal">
                  +{active.length - 7}
                </span>
              )}
            </div>
            {data.canManage && (
              <button
                onClick={() => setPicking(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded border-[1.5px] px-4 py-2.5 text-[13px] font-semibold text-white hover:brightness-95"
                style={{ background: vc, borderColor: vc }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M4 19V5a2 2 0 0 1 2-2h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
                  <path d="M12 11v6M9 14h6" />
                </svg>
                {sel ? "Change this month's pick" : "Set this month's pick"}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="grid items-start gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 font-display text-[22px]">Members</h3>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                {STATUS_FILTERS.map((opt) => {
                  const on = statusFilter.has(opt.key);
                  return (
                    <button
                      key={opt.key}
                      onClick={() => toggleStatusFilter(opt.key)}
                      className="cursor-pointer rounded-full border px-2.5 py-1 text-[11.5px] font-semibold"
                      style={
                        on
                          ? { borderColor: vc, background: vc, color: "#fff" }
                          : { borderColor: "var(--color-cream-2)", background: "#fff", color: "var(--color-charcoal)" }
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <span className="text-xs text-stone">
                {filteredSubs.length} of {subs.length}
              </span>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-cream-2 bg-white">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="eyebrow text-left text-stone">
                  <th className="py-2.5 pl-5 pr-3 font-semibold">Member</th>
                  <th className="px-3 py-2.5 font-semibold">Subscription</th>
                  <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Payment</th>
                  <th className="hidden px-3 py-2.5 font-semibold md:table-cell">Joined</th>
                  <th className="py-2.5 pl-3 pr-5 text-right font-semibold">Fee</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-sm text-stone">
                      {subs.length === 0 ? "No members yet." : "No members match this filter."}
                    </td>
                  </tr>
                )}
                {filteredSubs.map((s) => {
                  const m = memberOf(s.memberId);
                  if (!m) return null;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => router.push(`/members/${m.id}`)}
                      className="cursor-pointer border-t border-cream-2 hover:bg-shell/40"
                    >
                      <td className="py-2.5 pl-5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <MemberAvatar name={m.name} size={32} teal={teal} />
                          <div>
                            <div className="font-semibold">{m.name}</div>
                            <div className="text-xs text-stone">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Tag {...MEMBERSHIP_STATUS[s.status]} />
                      </td>
                      <td className="hidden px-3 py-2.5 sm:table-cell">
                        {s.payStatus === "ok" ? (
                          <span className="text-xs font-semibold text-[#2E6B4F]">Paid</span>
                        ) : (
                          <Tag {...PAY_STATUS[s.payStatus]} />
                        )}
                      </td>
                      <td className="hidden px-3 py-2.5 text-[13px] tabular-nums text-charcoal md:table-cell">{s.joined}</td>
                      <td className="py-2.5 pl-3 pr-5 text-right tabular-nums text-charcoal">{money(s.amount)}/mo</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border p-5" style={{ background: soft, borderColor: `${vc}33` }}>
            <div className="eyebrow mb-2" style={{ color: vc }}>
              This month · {monthLabel(month)}
            </div>
            {sel ? (
              <>
                <div className="font-display text-[22px] leading-tight">{sel.title}</div>
                {sel.isbn && <div className="mt-1 text-xs tabular-nums text-charcoal">{sel.isbn}</div>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {sel.orderState && <Tag {...HUB_STATES[sel.orderState]} />}
                  <span className="text-xs text-stone">
                    Qty {sel.quantity} ({sel.quantity - (sel.hostCopy ? 1 : 0)} active{sel.hostCopy ? " + host" : ""})
                  </span>
                </div>
                <div className="mt-2 text-[11.5px] text-stone">
                  Picked by {sel.selectedBy} ·{" "}
                  {new Date(sel.selectedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </div>
                {sel.orderState === "draft" && (
                  <Link href="/ordering/staging" className="mt-3 inline-block text-[12.5px] font-semibold underline" style={{ color: vc }}>
                    Review draft in the hub →
                  </Link>
                )}
              </>
            ) : (
              <>
                <div className="font-display text-xl text-coral">Not yet picked</div>
                <p className="mt-1.5 text-[13px] text-charcoal">
                  Set a book to auto-generate a hub order for {active.length} active member{active.length === 1 ? "" : "s"}.
                </p>
              </>
            )}
          </div>

          <div className="rounded-xl border border-cream-2 bg-white p-5">
            <div className="eyebrow mb-1 text-stone">Selection history</div>
            {selections.length === 0 && <p className="py-2 text-sm text-stone">No picks recorded yet.</p>}
            {selections.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 border-b border-cream-2 py-2.5 last:border-b-0">
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.1em] text-stone">{monthLabel(h.month)}</div>
                  <div className="font-display text-[16px]">{h.title}</div>
                </div>
                {h.orderState ? <Tag {...HUB_STATES[h.orderState]} /> : <Tag label="Arrived" color="#2E6B4F" bg="#E1EFE7" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {picking && (
        <SelectionOverlay
          club={club}
          memberships={data.memberships}
          existing={sel}
          publisherOptions={data.publisherOptions}
          onClose={() => setPicking(false)}
          onSaved={(msg) => {
            setPicking(false);
            refresh();
            showToast(msg);
          }}
        />
      )}
      {toast && <Toast text={toast} />}
    </div>
  );
}
