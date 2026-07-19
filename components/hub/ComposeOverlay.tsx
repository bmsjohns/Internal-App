"use client";

import { useMemo, useState } from "react";
import type { HubPublisher } from "@/lib/types";
import { composeOrderEmail, type HubBatch } from "@/lib/hub";
import { money } from "@/lib/clubs";
import { AccentButton, Overlay, OverlayHead } from "@/components/clubs/ui";
import { post } from "@/components/clubs/data";

// Review & send (spec C3): the sender reviews (and can edit) the exact email
// before it goes; what's stored against the batch is what was sent. "Send
// email" opens the user's mail app pre-filled AND marks the batch sent; the
// CSV download marks it sent the same way. Missing account number blocks
// outright (C6).
export default function ComposeOverlay({
  batch,
  publisher,
  userName,
  canSend,
  onClose,
  onSent,
  onGoPublishers,
}: {
  batch: HubBatch;
  publisher: HubPublisher | undefined;
  userName: string;
  canSend: boolean;
  onClose: () => void;
  onSent: (msg: string) => void;
  onGoPublishers: () => void;
}) {
  const composed = useMemo(
    () => (publisher && !batch.blocked ? composeOrderEmail(batch, publisher, userName) : null),
    [batch, publisher, userName]
  );
  const [body, setBody] = useState(composed?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!publisher || batch.blocked) {
    return (
      <Overlay onClose={onClose} width={520}>
        <OverlayHead title="Cannot send" sub={`${publisher?.name ?? "Unknown publisher"} · ${batch.account}`} onClose={onClose} />
        <div className="px-6 py-5">
          <div className="flex gap-3 rounded-[10px] border border-[#E9C5BE] bg-[#FBEAE7] px-4 py-3.5 text-rust-deep">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="mt-0.5 shrink-0">
              <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
            <div className="text-[13.5px]">
              <strong>
                No {batch.account} account number on file for {publisher?.name ?? "this publisher"}.
              </strong>
              <br />
              Add it in Publishers before sending — the order would otherwise go out malformed.
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2.5">
            <button onClick={onClose} className="cursor-pointer rounded border-[1.5px] border-cream-2 bg-white px-4 py-2.5 text-[13px] font-semibold text-charcoal hover:border-ink">
              Close
            </button>
            <AccentButton onClick={onGoPublishers}>Go to Publishers</AccentButton>
          </div>
        </div>
      </Overlay>
    );
  }

  const send = async (method: "Email" | "CSV") => {
    setBusy(true);
    setError("");
    try {
      const res = await post("/api/hub/send", {
        publisherId: batch.publisherId,
        account: batch.account,
        method,
        emailBody: body,
      });
      if (method === "CSV" && res.csv) {
        const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `${publisher.name.replace(/\s+/g, "-").toLowerCase()}-${batch.account.replace(/\s+/g, "-").toLowerCase()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      if (method === "Email") {
        // The team sends from their personal Gmail accounts — open Gmail
        // compose in a new tab with the reviewed copy pre-filled (works in
        // any browser, no default-mail-app dependency).
        const gmail =
          `https://mail.google.com/mail/?view=cm&fs=1` +
          `&to=${encodeURIComponent(publisher.repEmail)}` +
          `&su=${encodeURIComponent(composed!.subject)}` +
          `&body=${encodeURIComponent(body)}`;
        window.open(gmail, "_blank", "noopener");
      }
      onSent(method === "CSV" ? "CSV downloaded — batch marked sent" : "Gmail compose opened — batch marked sent, copy stored");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose} width={640}>
      <OverlayHead
        title={`${publisher.name} — ${batch.account}`}
        sub={`${batch.lines.length} lines from ${batch.sources.length} source${batch.sources.length > 1 ? "s" : ""} · one email to ${publisher.repName || "the rep"}`}
        onClose={onClose}
      />
      <div className="px-6 py-5">
        <div className="mb-3.5 flex flex-wrap gap-2 text-[12.5px] text-charcoal">
          <span className="rounded-full border border-cream-2 bg-white px-2.5 py-1">
            Account <strong className="tabular-nums">{batch.accountNumber}</strong>
          </span>
          <span className="rounded-full border border-cream-2 bg-white px-2.5 py-1">
            Est. cost <strong className="tabular-nums">{money(batch.total)}</strong>
          </span>
        </div>
        <div className="overflow-hidden rounded-[10px] border border-cream-2 bg-white">
          <div className="border-b border-cream-2 px-3.5 py-2.5 text-xs text-stone">
            To: {publisher.repName} &lt;{publisher.repEmail || "no rep email on file"}&gt; · Subject: {composed!.subject}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[220px] w-full resize-y border-none bg-white p-3.5 text-[13.5px] leading-relaxed text-ink"
          />
        </div>
        <div className="mt-2 text-[11.5px] text-stone">
          You review before it goes — Send opens Gmail with this exact copy pre-filled, and the copy is stored against
          the batch.
        </div>
        {!canSend && (
          <div className="mt-3 flex items-center gap-2 rounded-[9px] border border-cream-2 bg-cream px-3.5 py-2.5 text-[12.5px] font-semibold text-charcoal">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Sending needs the hub:send permission — ask a manager to send this batch.
          </div>
        )}
        {error && <p className="mt-2 text-[13px] font-semibold text-rust">{error}</p>}
        <div className="mt-4 flex flex-wrap justify-between gap-2.5">
          <button
            onClick={() => send("CSV")}
            disabled={!canSend || busy}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded border-[1.5px] border-cream-2 bg-white px-4 py-2.5 text-[13px] font-semibold text-charcoal hover:border-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M12 3v12M7 10l5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Download CSV
          </button>
          <div className="flex gap-2.5">
            <button onClick={onClose} className="cursor-pointer rounded border-[1.5px] border-cream-2 bg-white px-4 py-2.5 text-[13px] font-semibold text-charcoal hover:border-ink">
              Cancel
            </button>
            <AccentButton onClick={() => send("Email")} disabled={!canSend || busy}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              {busy ? "Sending…" : "Send email"}
            </AccentButton>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
