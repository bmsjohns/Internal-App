"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Location } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";
import { RETURN_CONDITIONS, RETURN_REASONS } from "@/lib/returns";
import { useVenue } from "@/components/VenueContext";
import { post, useReturnsData } from "@/components/clubs/data";
import { AccentButton, ModuleHeader, Toast, useAccent, venueColor } from "@/components/clubs/ui";
import { GhostButton, LineCover, QtyStepper } from "@/components/returns/ui";
import CameraScanner from "@/components/returns/CameraScanner";

// New return — the scan builder (spec: barcode point 1). Scanning a book
// puts it straight on the list: a known ISBN fills in title/cover/publisher
// (the Orders lookup pattern) and bumps the quantity if it's already here.
// Lines group by publisher as you scan, and creation splits them into one
// request per publisher — the Hub's batching rule, applied at birth.

interface DraftLine {
  key: string;
  isbn: string;
  title: string;
  publisherId: string | null;
  rrp: number | null;
  qty: number;
  reason: string;
  condition: string;
  looking: boolean;
  failed: boolean;
}

let keyN = 0;

export default function NewReturnPage() {
  const router = useRouter();
  const { venue } = useVenue();
  const { accent, accentSoft } = useAccent();
  const { data, refresh } = useReturnsData();
  const [loc, setLoc] = useState<Location>(venue === "simply" ? "Simply Books" : "Prologue");
  const [scan, setScan] = useState("");
  const [qty, setQty] = useState(1);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [camera, setCamera] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  const publishers = useMemo(() => data?.publishers ?? [], [data]);

  const matchPublisher = (name: string): string | null => {
    const needle = name.trim().toLowerCase();
    if (!needle) return null;
    // Same name/imprint matching as the Hub's staging, with imprints matched
    // by substring in either direction — lookups return strings like
    // "Vintage Publishing" for the imprint "Vintage". Imprints resolve to
    // the parent publisher; always correctable in the line's picker.
    const hit = publishers.find(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        needle.includes(p.name.toLowerCase()) ||
        p.imprints.some((im) => {
          const i = im.toLowerCase();
          return i === needle || needle.includes(i) || i.includes(needle);
        })
    );
    return hit?.id ?? null;
  };

  const addScan = (raw: string, count: number) => {
    const isbn = raw.replace(/[^0-9Xx]/g, "");
    if (!isbn) {
      showToast("Scan or type an ISBN");
      return;
    }
    setScan("");
    setQty(1);
    scanRef.current?.focus();

    let bumped = false;
    setLines((cur) => {
      const existing = cur.find((l) => l.isbn === isbn);
      if (existing) {
        bumped = true;
        showToast(`+${count} · ${existing.title}`);
        return cur.map((l) => (l.isbn === isbn ? { ...l, qty: l.qty + count } : l));
      }
      const key = `d${++keyN}`;
      const line: DraftLine = {
        key,
        isbn,
        title: `Looking up ${isbn}…`,
        publisherId: null,
        rrp: null,
        qty: count,
        reason: "slow-moving",
        condition: "new",
        looking: true,
        failed: false,
      };
      return [...cur, line];
    });
    if (bumped) return;

    fetch(`/api/isbn/${isbn}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const book = d?.book;
        setLines((cur) =>
          cur.map((l) =>
            l.isbn === isbn && l.looking
              ? book?.title
                ? {
                    ...l,
                    title: book.title,
                    publisherId: matchPublisher(String(book.publisher ?? "")),
                    rrp: book.rrp ?? null,
                    looking: false,
                  }
                : { ...l, title: `Unknown — ${isbn}`, looking: false, failed: true }
              : l
          )
        );
        showToast(book?.title ? `Added · ${book.title}` : "Unknown ISBN — added, check details");
      })
      .catch(() => {
        setLines((cur) =>
          cur.map((l) => (l.isbn === isbn && l.looking ? { ...l, title: `Unknown — ${isbn}`, looking: false, failed: true } : l))
        );
        showToast("Lookup failed — added, check details");
      });
  };

  const patchLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((cur) => cur.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const groups = useMemo(() => {
    const map = new Map<string, DraftLine[]>();
    for (const l of lines) {
      const k = l.publisherId ?? "unknown";
      map.set(k, [...(map.get(k) ?? []), l]);
    }
    return [...map.entries()];
  }, [lines]);

  const units = lines.reduce((s, l) => s + l.qty, 0);
  const nReqs = groups.length;
  const anyLooking = lines.some((l) => l.looking);

  const create = async () => {
    if (lines.length === 0 || creating) return;
    setCreating(true);
    try {
      const requests = groups.map(([pubId, ls]) => ({
        location: loc,
        origin: "general",
        eventRef: "",
        eventId: null,
        verifiedBy: "",
        publisherId: pubId === "unknown" ? null : pubId,
        notes: "",
        lines: ls.map((l) => ({
          title: l.title.startsWith("Looking up") ? `Unknown — ${l.isbn}` : l.title,
          isbn: l.isbn,
          quantity: l.qty,
          reason: l.reason,
          condition: l.condition,
          rrp: l.rrp,
        })),
      }));
      await post("/api/returns", { action: "create", requests });
      refresh();
      router.push("/returns/staging");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Create failed");
      setCreating(false);
    }
  };

  const pubName = (id: string) =>
    id === "unknown" ? "Unknown publisher" : (publishers.find((p) => p.id === id)?.name ?? "Unknown publisher");
  const acctOf = (id: string) =>
    id === "unknown" ? "" : (publishers.find((p) => p.id === id)?.accountNumbers[loc] ?? "");

  const select = "cursor-pointer rounded-md border border-cream-2 bg-cream px-2 py-[7px] text-[12.5px] text-charcoal";

  return (
    <div className="min-h-screen">
      <ModuleHeader
        eyebrow="Returns · new request"
        title="New return"
        subtitle="Scan books straight onto the list. A known ISBN fills in title, cover and publisher, and bumps the quantity if it's already here. Requests split automatically by publisher."
        backLabel="Cancel"
        onBack={() => router.push("/returns/staging")}
      />

      {/* scan bar */}
      <div className="border-b border-cream-2 px-4 py-4 sm:px-8" style={{ background: accentSoft }}>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="eyebrow text-charcoal">Returning from</span>
          <div className="flex gap-1.5">
            {LOCATIONS.map((l) => {
              const active = loc === l;
              const dot = venueColor(l);
              return (
                <button
                  key={l}
                  onClick={() => setLoc(l)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-[7px] text-[12.5px] font-semibold"
                  style={
                    active
                      ? { borderColor: dot, background: dot, color: "#fff" }
                      : { borderColor: "var(--color-cream-2)", background: "#fff", color: "var(--color-charcoal)" }
                  }
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: active ? "#fff" : dot }} />
                  {l}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex max-w-[940px] flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: accent }}>
              <path d="M4 5v14M8 5v14M11 5v14M14 5v14M17 5v14M20 5v14" />
            </svg>
            <input
              ref={scanRef}
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addScan(scan, qty))}
              placeholder="Scan barcode or type ISBN, then Enter"
              className="w-full rounded-lg border-[1.5px] bg-white py-3 pl-10 pr-3 text-[15px] text-ink"
              style={{ borderColor: accent }}
              inputMode="numeric"
              autoFocus
            />
          </div>
          <QtyStepper value={qty} onChange={setQty} />
          <AccentButton onClick={() => addScan(scan, qty)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add
          </AccentButton>
          <GhostButton onClick={() => setCamera(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-2h6l2 2h3v11H4z" />
              <circle cx="12" cy="13" r="3.2" />
            </svg>
            Camera
          </GhostButton>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-8">
        {groups.map(([pubId, ls]) => (
          <div key={pubId} className="mb-5">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <span className="font-display text-[19px]">{pubName(pubId)}</span>
              {acctOf(pubId) && (
                <span className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold tabular-nums" style={{ background: accentSoft, color: accent }}>
                  {acctOf(pubId)}
                </span>
              )}
              <span className="text-xs text-stone">→ one return request</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-cream-2 bg-white">
              {ls.map((l) => (
                <div key={l.key} className="flex flex-wrap items-center gap-3.5 border-t border-cream-2 px-4 py-3 first:border-t-0">
                  <LineCover isbn={l.isbn} title={l.title} width={42} height={58} />
                  <div className="min-w-[180px] flex-1">
                    <div className="text-sm font-semibold">{l.title}</div>
                    <div className="text-xs tabular-nums text-stone">{l.isbn}</div>
                    {l.failed && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-ochre">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3.5l9 16.5H3z" />
                          <path d="M12 10v4M12 16.5v.5" />
                        </svg>
                        Lookup failed — check ISBN and set the publisher below
                      </div>
                    )}
                  </div>
                  <select value={l.reason} onChange={(e) => patchLine(l.key, { reason: e.target.value })} className={select}>
                    {RETURN_REASONS.map((r) => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                  <select value={l.condition} onChange={(e) => patchLine(l.key, { condition: e.target.value })} className={select}>
                    {RETURN_CONDITIONS.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                  {(l.failed || pubId === "unknown") && (
                    <select
                      value={l.publisherId ?? ""}
                      onChange={(e) => patchLine(l.key, { publisherId: e.target.value || null })}
                      className={select}
                      title="Publisher"
                    >
                      <option value="">Publisher?</option>
                      {publishers.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                  <QtyStepper size="sm" value={l.qty} onChange={(n) => patchLine(l.key, { qty: n })} />
                  <button
                    onClick={() => setLines((cur) => cur.filter((x) => x.key !== l.key))}
                    aria-label="Remove"
                    className="cursor-pointer border-none bg-transparent p-1.5 text-stone hover:text-ink"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {lines.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-cream-2 px-5 py-14 text-center">
            <Image src="/assets/bird-reading.png" alt="" width={96} height={96} className="mb-3.5 h-auto w-[96px] opacity-90" />
            <div className="font-display text-[21px]">Scan the first book</div>
            <p className="mt-1.5 max-w-[340px] text-sm text-charcoal">
              Point a scanner at the barcode, or type an ISBN and press Enter. The camera works too on Chrome and Android.
            </p>
          </div>
        )}

        {lines.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-cream-2 pt-4">
            <div className="text-[13px] text-stone">
              {lines.length} title{lines.length === 1 ? "" : "s"} · {units} units · {nReqs} return{nReqs === 1 ? "" : "s"} will be created
            </div>
            <AccentButton onClick={create} disabled={creating || anyLooking} title={anyLooking ? "Waiting for a lookup to finish" : undefined}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 6" />
              </svg>
              {creating ? "Creating…" : `Create ${nReqs} return${nReqs === 1 ? "" : "s"}`}
            </AccentButton>
          </div>
        )}
      </div>

      {camera && (
        <CameraScanner
          hint="Add a book straight to the return"
          onScan={(isbn) => addScan(isbn, 1)}
          onClose={() => setCamera(false)}
        />
      )}
      {toast && <Toast text={toast} />}
    </div>
  );
}
