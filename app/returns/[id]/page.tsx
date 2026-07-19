"use client";

import { use, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReturnRequest, ReturnStatus } from "@/lib/types";
import {
  conditionLabel,
  estimatedCredit,
  isReturnOverdue,
  matchPickScan,
  pickComplete,
  pickedUnits,
  reasonLabel,
  returnAccountNumber,
  returnStatusMeta,
  returnUnits,
  routeLabel,
  workingDaysSince,
} from "@/lib/returns";
import { money } from "@/lib/clubs";
import { post, useReturnsData } from "@/components/clubs/data";
import { AccentButton, Overlay, OverlayHead, Toast, useAccent } from "@/components/clubs/ui";
import { GhostButton, LineCover, OriginPill, QtyStepper, ReturnStatusPill } from "@/components/returns/ui";
import ReturnTimeline from "@/components/returns/ReturnTimeline";
import CameraScanner from "@/components/returns/CameraScanner";

// Return detail — the clickable timeline (Orders V2 pattern: forward one
// validated step at a time, back any distance with a confirm), the pick &
// box panel while approved, and the full record with audit trail.

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
const fmtStamp = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

type OverlayKind = { kind: "ra" } | { kind: "credit" } | { kind: "revert"; to: ReturnStatus } | null;

export default function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { accent, accentSoft } = useAccent();
  const { data, error, refresh } = useReturnsData();
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState<OverlayKind>(null);
  const [raNumber, setRaNumber] = useState("");
  const [raFilename, setRaFilename] = useState("");
  const [raFile, setRaFile] = useState<File | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [pickScan, setPickScan] = useState("");
  const [pickQty, setPickQty] = useState(1);
  const [pickEdits, setPickEdits] = useState<Record<string, number>>({});
  const [camera, setCamera] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  const raw = data?.returns.find((x) => x.id === id) ?? null;
  // Optimistic pick counts so rapid scanning feels instant.
  const r: ReturnRequest | null = useMemo(() => {
    if (!raw) return null;
    return { ...raw, lines: raw.lines.map((l) => ({ ...l, picked: pickEdits[l.id] ?? l.picked })) };
  }, [raw, pickEdits]);

  const pub = data?.publishers.find((p) => p.id === r?.publisherId) ?? null;

  if (error) return <p className="px-8 py-10 text-sm font-semibold text-rust">{error}</p>;
  if (!data || !r) {
    return <p className="px-8 py-10 text-sm text-stone">{!data ? "Loading…" : "Return not found."}</p>;
  }

  const act = async (body: Record<string, unknown>, done?: string) => {
    setBusy(true);
    try {
      await post("/api/returns", body);
      refresh();
      if (done) showToast(done);
      return true;
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Action failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  // One pick action for both inputs — a barcode scan or a line's Pick
  // button — honouring the shared quantity (clamped at what's left).
  const pickLine = async (lineId: string, title: string) => {
    const line = r.lines.find((l) => l.id === lineId);
    if (!line) return;
    const n = Math.min(pickQty, line.quantity - line.picked);
    if (n <= 0) {
      showToast("All copies of that title already picked");
      return;
    }
    setPickEdits((e) => ({ ...e, [lineId]: line.picked + n }));
    setPickQty(1);
    showToast(`Picked ${n > 1 ? `${n} × ` : ""}${title}`);
    try {
      await post("/api/returns", { action: "pick", id: r.id, lineId, count: n });
      refresh();
    } catch (e) {
      setPickEdits((edits) => {
        const rest = { ...edits };
        delete rest[lineId];
        return rest;
      });
      showToast(e instanceof Error ? e.message : "Pick failed");
    }
  };

  const doPick = (scanned: string) => {
    const result = matchPickScan(r, scanned);
    setPickScan("");
    if (!result.ok) {
      showToast(
        result.reason === "not-on-list"
          ? "Not on this pick list"
          : result.reason === "already-picked"
            ? "All copies of that title already picked"
            : "Everything is picked"
      );
      return;
    }
    void pickLine(result.lineId, result.title);
  };

  const openApprove = () => {
    setRaNumber(r.raNumber);
    setRaFilename(r.raFilename);
    setOverlay({ kind: "ra" });
  };
  const openCredit = () => {
    setCreditAmount("");
    setOverlay({ kind: "credit" });
  };

  const onStep = (target: ReturnStatus, direction: "forward" | "back" | "blocked") => {
    if (direction === "blocked") {
      showToast("Move one step at a time");
      return;
    }
    if (direction === "back") {
      setOverlay({ kind: "revert", to: target });
      return;
    }
    if (target === "awaiting") {
      if (!r.route) showToast("Choose a return route first — set it from staging");
      else act({ action: "submit", id: r.id }, `${r.code} submitted — awaiting RA`);
    } else if (target === "approved") openApprove();
    else if (target === "shipped") {
      if (!pickComplete(r)) showToast("Pick every copy first — scan them below");
      else act({ action: "ship", id: r.id }, `${r.code} marked shipped`);
    } else if (target === "credit") openCredit();
  };

  const gardners = r.route === "gardners";
  const overdue = isReturnOverdue(r);
  const picked = pickedUnits(r);
  const total = returnUnits(r);
  const complete = pickComplete(r);

  const meta: { label: string; value: string }[] = [
    { label: "Requested by", value: r.requestedBy },
    ...(r.verifiedBy ? [{ label: "Verified by", value: r.verifiedBy }] : []),
    ...(r.origin === "event" && r.eventRef ? [{ label: "Event", value: r.eventRef }] : []),
    { label: "Account no.", value: returnAccountNumber(r, pub) || "—" },
    { label: "Date requested", value: fmtDate(r.dateRequested) },
    ...(r.dateApproved ? [{ label: "Date approved", value: fmtDate(r.dateApproved) }] : []),
    ...(r.dateShipped ? [{ label: "Date shipped", value: fmtDate(r.dateShipped) }] : []),
    ...(r.dateCreditConfirmed ? [{ label: "Credit confirmed", value: fmtDate(r.dateCreditConfirmed) }] : []),
    { label: "Est. credit", value: money(estimatedCredit(r, pub)) },
    ...(r.creditAmount != null ? [{ label: "Confirmed credit", value: money(r.creditAmount) }] : []),
  ];

  const field = "w-full rounded-lg border-[1.5px] border-cream-2 bg-white px-3.5 py-2.5 text-[15px] text-ink";

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 pb-12 pt-6 sm:px-8">
      <button
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/returns"))}
        className="mb-4 inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[13px] font-semibold text-stone hover:text-ink"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back to returns
      </button>

      {/* head */}
      <div className="flex flex-wrap items-start justify-between gap-5 pb-[18px]" style={{ borderBottom: `1.5px solid ${accent}` }}>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-[30px] leading-none tracking-[-0.01em] sm:text-[34px]">{r.code}</h1>
            <ReturnStatusPill status={r.status} />
            <OriginPill r={r} />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-[18px] text-sm text-charcoal">
            <span className="inline-flex items-center gap-1.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" />
                <circle cx="12" cy="10" r="2.4" />
              </svg>
              {r.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 21V5l8-2 8 2v16" />
                <path d="M9 21v-5h6v5" />
              </svg>
              {pub?.name ?? "Unknown publisher"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {gardners ? (
                  <>
                    <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" />
                    <circle cx="7.5" cy="18" r="1.6" />
                    <circle cx="17.5" cy="18" r="1.6" />
                  </>
                ) : (
                  <>
                    <path d="M4 21V5l8-2 8 2v16" />
                    <path d="M8 9h1M8 13h1M15 9h1M15 13h1" />
                  </>
                )}
              </svg>
              {routeLabel(r.route)}
            </span>
          </div>
        </div>
        {r.status === "requested" && (
          <AccentButton onClick={() => act({ action: "submit", id: r.id }, `${r.code} submitted — awaiting RA`)} disabled={!r.route || busy} title={!r.route ? "Choose a route from staging first" : undefined}>
            Submit for approval
          </AccentButton>
        )}
        {r.status === "awaiting" && <AccentButton onClick={openApprove} disabled={busy}>Add RA / approve</AccentButton>}
        {r.status === "shipped" && <AccentButton onClick={openCredit} disabled={busy}>Confirm credit</AccentButton>}
      </div>

      {/* timeline */}
      <div className="mb-1 mt-6">
        <ReturnTimeline r={r} accent={accent} onStep={onStep} />
      </div>

      {overdue && (
        <div className="mt-3.5 flex items-center gap-2 rounded-lg border border-[#E9C5BE] bg-[#FBEAE7] px-3.5 py-2.5 text-[13px] font-semibold text-rust-deep">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3.5l9 16.5H3z" />
            <path d="M12 10v4M12 16.5v.5" />
          </svg>
          {r.status === "awaiting"
            ? `Awaiting RA for ${workingDaysSince(r.dateSubmitted ?? r.dateRequested)} working days — chase ${gardners ? "Gardners" : `${pub?.repName ?? "the rep"} at ${pub?.name ?? "the publisher"}`}.`
            : `Shipped ${workingDaysSince(r.dateShipped)} working days ago, still no credit — chase the publisher's credit note.`}
        </div>
      )}

      {/* pick & box */}
      {r.status === "approved" && (
        <div className="mt-6 overflow-hidden rounded-xl border border-cream-2 bg-white">
          <div className="border-b border-cream-2 px-[18px] py-4" style={{ background: accentSoft }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-display text-[19px]">Pick &amp; box</div>
                <div className="mt-0.5 text-[12.5px] text-charcoal">
                  {picked} of {total} copies boxed{complete ? " — ready to ship" : ""}
                </div>
              </div>
              <GhostButton onClick={() => setCamera(true)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8h3l2-2h6l2 2h3v11H4z" />
                  <circle cx="12" cy="13" r="3.2" />
                </svg>
                Scan with camera
              </GhostButton>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[220px] flex-1">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: accent }}>
                  <path d="M4 5v14M8 5v14M11 5v14M14 5v14M17 5v14M20 5v14" />
                </svg>
                <input
                  value={pickScan}
                  onChange={(e) => setPickScan(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doPick(pickScan))}
                  placeholder="Scan a barcode to confirm it's picked"
                  aria-label="Scan a barcode to confirm it is picked"
                  className="w-full rounded-lg border-[1.5px] bg-white py-3 pl-10 pr-3 text-[15px] text-ink"
                  style={{ borderColor: accent }}
                  inputMode="numeric"
                />
              </div>
              <QtyStepper value={pickQty} onChange={setPickQty} />
              <span className="text-xs text-stone">copies per scan / pick</span>
            </div>
          </div>
          {r.lines.map((l) => {
            const done = l.picked >= l.quantity;
            return (
              <div
                key={l.id}
                className="flex items-center gap-3.5 border-t border-cream-2 px-[18px] py-3"
                style={{ background: done ? accentSoft : "#fff" }}
              >
                <LineCover isbn={l.isbn} title={l.title} width={34} height={48} />
                <div className="min-w-0 flex-1">
                  <div className={`font-semibold ${done ? "text-stone line-through" : ""}`}>{l.title}</div>
                  <div className="text-xs tabular-nums text-stone">{l.isbn}</div>
                </div>
                <span className="whitespace-nowrap font-semibold tabular-nums text-charcoal">
                  {l.picked} / {l.quantity}
                </span>
                {!done && (
                  <GhostButton onClick={() => pickLine(l.id, l.title)} title={`Mark ${Math.min(pickQty, l.quantity - l.picked)} picked without scanning`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 6" />
                    </svg>
                    Pick{pickQty > 1 ? ` ${Math.min(pickQty, l.quantity - l.picked)}` : ""}
                  </GhostButton>
                )}
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full"
                  style={done ? { background: accent, color: "#fff" } : { background: "var(--color-cream-2)", color: "var(--color-stone)" }}
                >
                  {done && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5L20 6" />
                    </svg>
                  )}
                </span>
              </div>
            );
          })}
          <div className="flex justify-end border-t border-cream-2 px-[18px] py-3.5">
            <AccentButton
              onClick={() => act({ action: "ship", id: r.id }, `${r.code} marked shipped`)}
              disabled={!complete || busy}
              title={!complete ? "Scan every copy before shipping" : undefined}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" />
                <circle cx="7.5" cy="18" r="1.6" />
                <circle cx="17.5" cy="18" r="1.6" />
              </svg>
              Confirm shipped
            </AccentButton>
          </div>
        </div>
      )}

      {/* detail grid */}
      <div className="mt-6 grid grid-cols-1 gap-[22px] lg:grid-cols-[1.55fr_1fr]">
        <div>
          <div className="eyebrow mb-2.5 text-stone">Line items ({r.lines.length})</div>
          <div className="overflow-hidden rounded-xl border border-cream-2 bg-white">
            {r.lines.map((l) => (
              <div key={l.id} className="flex items-center gap-3.5 border-t border-cream-2 px-4 py-3.5 first:border-t-0">
                <LineCover isbn={l.isbn} title={l.title} width={44} height={62} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-semibold">{l.title}</div>
                  <div className="mt-0.5 text-xs tabular-nums text-stone">{l.isbn || "No ISBN"}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {l.reason && (
                      <span className="rounded-full border border-cream-2 bg-cream px-2 py-0.5 text-[11px] font-semibold text-charcoal">
                        {reasonLabel(l.reason)}
                      </span>
                    )}
                    {l.condition && (
                      <span className="rounded-full border border-cream-2 bg-cream px-2 py-0.5 text-[11px] font-semibold text-charcoal">
                        {conditionLabel(l.condition)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="whitespace-nowrap text-right">
                  <div className="font-display text-[19px] tabular-nums">× {l.quantity}</div>
                  <div className="text-[11px] text-stone">
                    {l.rrp != null ? money(l.quantity * l.rrp) + " RRP" : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {r.notes && (
            <>
              <div className="eyebrow mb-2 mt-4 text-stone">Notes</div>
              <div className="rounded-[10px] bg-shell/60 px-4 py-3.5 text-[13.5px] leading-relaxed text-charcoal">{r.notes}</div>
            </>
          )}
        </div>

        <div>
          <div className="eyebrow mb-2.5 text-stone">Authorisation</div>
          <div className="rounded-xl border border-cream-2 bg-white px-[18px] py-4">
            {r.raNumber ? (
              <>
                <div className="text-[11px] text-stone">{gardners ? "Gardners authorisation" : "RA number"}</div>
                <div className="mt-0.5 font-display text-xl tabular-nums">{r.raNumber}</div>
                {r.raFilename && (
                  <div className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: accent }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 10.5l-8.5 8.5a4 4 0 01-5.7-5.7l8.5-8.5a2.7 2.7 0 013.8 3.8l-8.2 8.2a1.4 1.4 0 01-2-2l7.5-7.5" />
                    </svg>
                    {r.raFilename}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-[13px] text-stone">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="12" cy="12" r="8.5" />
                  <path d="M12 7v5l3 2" />
                </svg>
                {r.status === "requested"
                  ? "Not yet submitted"
                  : `Waiting on ${gardners ? "Gardners" : (pub?.repName ?? "the publisher")}`}
              </div>
            )}
          </div>

          <div className="eyebrow mb-2.5 mt-[18px] text-stone">Record</div>
          <div className="rounded-xl border border-cream-2 bg-white px-[18px] py-1.5">
            {meta.map((m) => (
              <div key={m.label} className="flex justify-between gap-3.5 border-t border-cream-2 py-2.5 text-[13.5px] first:border-t-0">
                <span className="text-stone">{m.label}</span>
                <span className="text-right font-semibold text-ink">{m.value}</span>
              </div>
            ))}
          </div>

          <div className="eyebrow mb-2.5 mt-[18px] text-stone">Audit trail</div>
          <div className="flex flex-col">
            {[...r.log].reverse().map((a, i) => (
              <div key={i} className="flex gap-3 pb-3.5">
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-[9px] w-[9px] rounded-full" style={{ background: i === 0 ? accent : "var(--color-cream-2)" }} />
                  <span className="mt-1 min-h-3.5 w-[1.5px] flex-1 bg-cream-2" />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-ink">{a.action}</div>
                  <div className="mt-px text-[11.5px] text-stone">
                    {a.by} · {fmtStamp(a.at)}
                  </div>
                </div>
              </div>
            ))}
            {r.log.length === 0 && <p className="text-[13px] text-stone">No changes recorded yet.</p>}
          </div>
        </div>
      </div>

      {/* overlays */}
      {overlay?.kind === "ra" && (
        <Overlay onClose={() => setOverlay(null)} width={460}>
          <OverlayHead
            title={gardners ? "Log Gardners authorisation" : "Add RA number"}
            sub={
              gardners
                ? "Enter the authorisation reference from the Gardners returns portal, then mark it approved and ready to pick."
                : "Enter the RA number your publisher rep issued. Nothing ships without it."
            }
            onClose={() => setOverlay(null)}
          />
          <div className="px-6 py-5">
            <label className="eyebrow mb-1.5 block text-stone">{gardners ? "Gardners authorisation ref" : "RA number"}</label>
            <input
              value={raNumber}
              onChange={(e) => setRaNumber(e.target.value)}
              placeholder={gardners ? "e.g. GDN-2026-0000" : "e.g. PUB-RA-00000"}
              aria-label={gardners ? "Gardners authorisation reference" : "Return authorisation number"}
              className={field}
              autoFocus
            />
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setRaFile(file);
                setRaFilename(file?.name ?? "");
              }}
            />
            <button
              onClick={() => {
                if (raFilename) {
                  setRaFile(null);
                  setRaFilename("");
                  if (fileRef.current) fileRef.current.value = "";
                } else fileRef.current?.click();
              }}
              className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-cream-2 bg-transparent px-3.5 py-2.5 text-[13px] font-semibold text-charcoal hover:border-ink"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10.5l-8.5 8.5a4 4 0 01-5.7-5.7l8.5-8.5a2.7 2.7 0 013.8 3.8l-8.2 8.2a1.4 1.4 0 01-2-2l7.5-7.5" />
              </svg>
              {raFilename ? `${raFilename} ✓ (tap to remove)` : "Attach approval form (PDF / screenshot)"}
            </button>
            <div className="mt-4 flex justify-end gap-2.5">
              <GhostButton onClick={() => setOverlay(null)}>Cancel</GhostButton>
              <AccentButton
                onClick={async () => {
                  if (!raNumber.trim()) {
                    showToast("Enter the RA number");
                    return;
                  }
                  if (raFile) {
                    setBusy(true);
                    try {
                      const form = new FormData();
                      form.append("file", raFile);
                      const uploaded = await fetch(`/api/returns/${r.id}/attachment`, { method: "POST", body: form });
                      if (!uploaded.ok) throw new Error((await uploaded.json()).error ?? "Couldn’t upload approval form");
                    } catch (e) {
                      showToast(e instanceof Error ? e.message : "Couldn’t upload approval form");
                      setBusy(false);
                      return;
                    }
                    setBusy(false);
                  }
                  const ok = await act(
                    { action: "approve", id: r.id, raNumber, raFilename },
                    `${r.code} approved — ready to pick`
                  );
                  if (ok) {
                    setRaFile(null);
                    setOverlay(null);
                  }
                }}
                disabled={busy}
              >
                Approve return
              </AccentButton>
            </div>
          </div>
        </Overlay>
      )}

      {overlay?.kind === "credit" && (
        <Overlay onClose={() => setOverlay(null)} width={460}>
          <OverlayHead
            title="Confirm credit"
            sub="The publisher has confirmed the credit. Record the amount from their credit note if it's worth keeping — otherwise just confirm to close the return."
            onClose={() => setOverlay(null)}
          />
          <div className="px-6 py-5">
            <label className="eyebrow mb-1.5 block text-stone">Credit amount confirmed (optional)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-stone">£</span>
              <input
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                aria-label="Confirmed credit amount"
                className={`${field} pl-7 tabular-nums`}
                inputMode="decimal"
                autoFocus
              />
            </div>
            <div className="mt-4 flex justify-end gap-2.5">
              <GhostButton onClick={() => setOverlay(null)}>Cancel</GhostButton>
              <AccentButton
                onClick={async () => {
                  const ok = await act(
                    { action: "credit", id: r.id, amount: creditAmount || null },
                    `${r.code} closed — credit confirmed`
                  );
                  if (ok) setOverlay(null);
                }}
                disabled={busy}
              >
                Confirm &amp; close
              </AccentButton>
            </div>
          </div>
        </Overlay>
      )}

      {overlay?.kind === "revert" && (
        <Overlay onClose={() => setOverlay(null)} width={460}>
          <OverlayHead
            title="Move back a stage?"
            sub={`This reverts ${r.code} to "${returnStatusMeta(overlay.to).label}". Later dates are cleared and the change is logged to the audit trail.`}
            onClose={() => setOverlay(null)}
          />
          <div className="flex justify-end gap-2.5 px-6 pb-5 pt-1">
            <GhostButton onClick={() => setOverlay(null)}>Keep as is</GhostButton>
            <AccentButton
              onClick={async () => {
                const ok = await act(
                  { action: "revert", id: r.id, to: overlay.to },
                  `Moved back to ${returnStatusMeta(overlay.to).label}`
                );
                if (ok) {
                  setPickEdits({});
                  setOverlay(null);
                }
              }}
              disabled={busy}
            >
              Move back
            </AccentButton>
          </div>
        </Overlay>
      )}

      {camera && (
        <CameraScanner hint="Confirm the next unpicked copy" onScan={(isbn) => doPick(isbn)} onClose={() => setCamera(false)} />
      )}
      {toast && <Toast text={toast} />}
    </div>
  );
}
