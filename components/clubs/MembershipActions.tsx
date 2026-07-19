"use client";

import { useState } from "react";
import type { Club, ClubMembership, Member } from "@/lib/types";
import { AccentButton, Overlay, OverlayHead, useAccent } from "./ui";
import { post } from "./data";

// Stripe write flows (spec B2), all logged who/when server-side:
//  · Cancel — immediate vs end-of-billing-period chosen at cancel time.
//  · Pause — Stripe's native pause; resume is a one-click row action.
//  · Move — ONE guided flow: cancel Club A sub + create Club B sub.
// Refunds are deliberately absent (view-only v1 — issued in Stripe).

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function CancelOverlay({
  membership,
  member,
  club,
  onClose,
  onDone,
}: {
  membership: ClubMembership;
  member: Member;
  club: Club;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const { accent, accentSoft } = useAccent();
  const [when, setWhen] = useState<"period_end" | "now">("period_end");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await post("/api/clubs/actions", { action: "cancel", membershipId: membership.id, when });
      onDone(when === "now" ? "Subscription cancelled immediately (logged)" : "Cancels at period end (logged)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
      setBusy(false);
    }
  };

  const opt = (v: "period_end" | "now", label: string, sub: string) => {
    const sel = when === v;
    return (
      <button
        key={v}
        onClick={() => setWhen(v)}
        className="mb-2 flex w-full cursor-pointer items-start gap-2.5 rounded-[9px] border-[1.5px] px-3.5 py-3 text-left"
        style={{ borderColor: sel ? accent : "var(--color-cream-2)", background: sel ? accentSoft : "#fff" }}
      >
        <span
          className="mt-0.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.5px]"
          style={{ borderColor: sel ? accent : "var(--color-stone)" }}
        >
          {sel && <span className="h-[9px] w-[9px] rounded-full" style={{ background: accent }} />}
        </span>
        <span>
          <span className="block text-sm font-semibold">{label}</span>
          <span className="text-[12.5px] text-stone">{sub}</span>
        </span>
      </button>
    );
  };

  return (
    <Overlay onClose={onClose} width={460}>
      <OverlayHead title="Cancel subscription" sub={`${member.name} · ${club.name}`} onClose={onClose} />
      <div className="px-6 py-5">
        {opt("period_end", "At end of billing period", `Access continues until ${membership.periodEnd}. No refund needed.`)}
        {opt("now", "Immediately", "Cancels access now. Any refund is handled separately in Stripe.")}
        {error && <p className="mt-2 text-[13px] font-semibold text-rust">{error}</p>}
        <div className="mt-3.5 flex justify-end gap-2.5">
          <button onClick={onClose} className="cursor-pointer rounded border-[1.5px] border-cream-2 bg-white px-4 py-2.5 text-[13px] font-semibold text-charcoal hover:border-ink">
            Keep it
          </button>
          <button
            onClick={run}
            disabled={busy}
            className="cursor-pointer rounded border-[1.5px] border-rust-deep bg-rust-deep px-4 py-2.5 text-[13px] font-semibold text-white hover:brightness-95 disabled:opacity-50"
          >
            {busy ? "Cancelling…" : "Cancel subscription"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

export function PauseOverlay({
  membership,
  member,
  club,
  onClose,
  onDone,
}: {
  membership: ClubMembership;
  member: Member;
  club: Club;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await post("/api/clubs/actions", { action: "pause", membershipId: membership.id });
      onDone("Subscription paused in Stripe (logged)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pause failed");
      setBusy(false);
    }
  };
  return (
    <Overlay onClose={onClose} width={430}>
      <OverlayHead title="Pause subscription" sub={`${member.name} · ${club.name}`} onClose={onClose} />
      <div className="px-6 py-5">
        <p className="mb-4 text-sm text-charcoal">
          Uses Stripe&rsquo;s native subscription pause. Billing stops until you resume — from the member&rsquo;s page, any time.
        </p>
        {error && <p className="mb-2 text-[13px] font-semibold text-rust">{error}</p>}
        <div className="flex justify-end gap-2.5">
          <button onClick={onClose} className="cursor-pointer rounded border-[1.5px] border-cream-2 bg-white px-4 py-2.5 text-[13px] font-semibold text-charcoal hover:border-ink">
            Back
          </button>
          <AccentButton onClick={run} disabled={busy}>
            {busy ? "Pausing…" : "Pause billing"}
          </AccentButton>
        </div>
      </div>
    </Overlay>
  );
}

export function MoveOverlay({
  membership,
  member,
  clubs,
  onClose,
  onDone,
}: {
  membership: ClubMembership;
  member: Member;
  clubs: Club[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const { accent, accentSoft } = useAccent();
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const from = clubs.find((c) => c.id === membership.clubId);
  const targets = clubs.filter((c) => c.id !== membership.clubId && c.status !== "inactive");
  const targetClub = targets.find((c) => c.id === target);

  const run = async () => {
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      await post("/api/clubs/actions", { action: "move", membershipId: membership.id, targetClubId: target });
      onDone("Member moved — old sub cancelled, new sub created (logged)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Move failed");
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose} width={480}>
      <OverlayHead
        title={`Move ${firstName(member.name)} between clubs`}
        sub="One guided step: cancels the current subscription in Stripe and creates a new one against the same member."
        onClose={onClose}
      />
      <div className="px-6 py-5">
        <div className="mb-4 flex items-center gap-3 rounded-[9px] border border-cream-2 bg-white px-3.5 py-3">
          <div className="flex-1">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-stone">From</div>
            <div className="text-sm font-semibold">{from?.name ?? "?"}</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-stone">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          <div className="flex-1 text-right">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-stone">To</div>
            <div className="text-sm font-semibold" style={{ color: targetClub ? accent : "var(--color-stone)" }}>
              {targetClub?.name ?? "Choose…"}
            </div>
          </div>
        </div>
        <div className="max-h-[240px] overflow-auto">
          {targets.map((c) => {
            const sel = target === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setTarget(c.id)}
                className="mb-2 flex w-full cursor-pointer items-center justify-between gap-3 rounded-[9px] border-[1.5px] px-3.5 py-2.5 text-left"
                style={{ borderColor: sel ? accent : "var(--color-cream-2)", background: sel ? accentSoft : "#fff" }}
              >
                <span>
                  <span className="block text-sm font-semibold">{c.name}</span>
                  <span className="text-xs text-stone">
                    {c.location} · {c.cadence}
                  </span>
                </span>
                {sel && (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: accent }}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
        {error && <p className="mt-2 text-[13px] font-semibold text-rust">{error}</p>}
        <div className="mt-3.5 flex justify-end gap-2.5">
          <button onClick={onClose} className="cursor-pointer rounded border-[1.5px] border-cream-2 bg-white px-4 py-2.5 text-[13px] font-semibold text-charcoal hover:border-ink">
            Cancel
          </button>
          <AccentButton onClick={run} disabled={!target || busy}>
            {busy ? "Moving…" : "Confirm move"}
          </AccentButton>
        </div>
      </div>
    </Overlay>
  );
}
