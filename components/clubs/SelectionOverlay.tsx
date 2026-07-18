"use client";

import { useEffect, useMemo, useState } from "react";
import type { Club, ClubMembership } from "@/lib/types";
import { currentMonthKey, monthLabel } from "@/lib/clubs";
import { AccentButton, Overlay, OverlayHead, useAccent } from "./ui";
import { post, type PublisherOption, type SelectionWithState } from "./data";

// "This month's pick" (spec B4): single-select entry — title + ISBN (with
// lookup), quantity auto-set to the EXACT active-member count, one checkbox
// for a host copy (+1). Saving stages/updates the draft in the Ordering Hub.
export default function SelectionOverlay({
  club,
  memberships,
  existing,
  publisherOptions,
  onClose,
  onSaved,
}: {
  club: Club;
  memberships: ClubMembership[];
  existing: SelectionWithState | null;
  publisherOptions: PublisherOption[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { accent, accentSoft } = useAccent();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [isbn, setIsbn] = useState(existing?.isbn ?? "");
  const [publisherId, setPublisherId] = useState<string>(existing?.publisherId ?? "");
  const [imprint, setImprint] = useState(existing?.imprint ?? "");
  const [rrp, setRrp] = useState(existing?.rrp != null ? String(existing.rrp) : "");
  const [hostCopy, setHostCopy] = useState(existing?.hostCopy ?? true);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const month = currentMonthKey();
  const activeCount = useMemo(
    () => memberships.filter((s) => s.clubId === club.id && s.status === "active").length,
    [memberships, club.id]
  );
  const quantity = activeCount + (hostCopy ? 1 : 0);

  // ISBN lookup fires once a full barcode is present — scan, glance, save.
  useEffect(() => {
    const clean = isbn.replace(/[^0-9Xx]/g, "");
    if (clean.length !== 13 && clean.length !== 10) return;
    let stale = false;
    setLooking(true);
    fetch(`/api/isbn/${clean}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (stale || !d?.book) return;
        setTitle((t) => t || d.book.title);
        if (d.book.rrp != null) setRrp((v) => v || String(d.book.rrp));
        if (d.book.publisher) {
          const needle = String(d.book.publisher).toLowerCase();
          const match = publisherOptions.find(
            (p) =>
              p.name.toLowerCase().includes(needle) ||
              needle.includes(p.name.toLowerCase()) ||
              p.imprints.some((im) => im.toLowerCase() === needle)
          );
          if (match) {
            setPublisherId((cur) => cur || match.id);
            const im = match.imprints.find((x) => x.toLowerCase() === needle);
            if (im) setImprint((cur) => cur || im);
          }
        }
      })
      .catch(() => {})
      .finally(() => !stale && setLooking(false));
    return () => {
      stale = true;
    };
  }, [isbn, publisherOptions]);

  const selectedPub = publisherOptions.find((p) => p.id === publisherId);

  const save = async () => {
    if (!title.trim()) {
      setError("Pick a book first — title is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await post("/api/clubs/selections", {
        clubId: club.id,
        month,
        title,
        isbn,
        publisherId: publisherId || null,
        imprint,
        rrp: rrp ? Number(rrp) : null,
        hostCopy,
      });
      onSaved(existing ? "Pick updated — hub draft refreshed" : "Pick saved — draft created in Ordering Hub");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  };

  const field = "w-full rounded-md border border-cream-2 bg-white px-3 py-2.5 text-sm text-ink";
  const label = "eyebrow mb-1.5 block text-stone";

  return (
    <Overlay onClose={onClose} width={560}>
      <OverlayHead
        title="This month’s pick"
        sub={`${club.name} · ${monthLabel(month)} · single-select, one book`}
        onClose={onClose}
      />
      <div className="px-6 py-5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[1fr_180px]">
          <div>
            <label className={label}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" className={field} />
          </div>
          <div>
            <label className={label}>ISBN {looking && <span className="normal-case tracking-normal">· looking up…</span>}</label>
            <input
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="Scan or type"
              className={`${field} tabular-nums`}
              inputMode="numeric"
            />
          </div>
          <div>
            <label className={label}>Publisher</label>
            <select value={publisherId} onChange={(e) => { setPublisherId(e.target.value); setImprint(""); }} className={field}>
              <option value="">Not set</option>
              {publisherOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>RRP £</label>
            <input value={rrp} onChange={(e) => setRrp(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" className={`${field} tabular-nums`} inputMode="decimal" />
          </div>
          {selectedPub && selectedPub.imprints.length > 0 && (
            <div className="sm:col-span-2">
              <label className={label}>Imprint (inherits the publisher’s rate)</label>
              <select value={imprint} onChange={(e) => setImprint(e.target.value)} className={field}>
                <option value="">Not set</option>
                {selectedPub.imprints.map((im) => (
                  <option key={im} value={im}>{im}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-[9px] border border-cream-2 bg-white px-3.5 py-3">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] border-[1.5px] text-white"
            style={{ borderColor: hostCopy ? accent : "var(--color-stone)", background: hostCopy ? accent : "#fff" }}
          >
            {hostCopy && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </span>
          <input type="checkbox" checked={hostCopy} onChange={() => setHostCopy(!hostCopy)} className="sr-only" />
          <span className="text-sm">
            Add one host copy <span className="text-stone">(+1)</span>
          </span>
        </label>

        {error && <p className="mt-3 text-[13px] font-semibold text-rust">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-cream-2 pt-4">
          <div className="text-[13px] text-charcoal">
            Quantity auto-set to{" "}
            <strong className="rounded px-1.5 py-0.5 text-[15px] tabular-nums" style={{ background: accentSoft, color: accent }}>
              {quantity}
            </strong>{" "}
            — {activeCount} active member{activeCount === 1 ? "" : "s"}
            {hostCopy ? " + 1 host" : ""}
          </div>
          <AccentButton onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save & create draft"}
          </AccentButton>
        </div>
      </div>
    </Overlay>
  );
}
