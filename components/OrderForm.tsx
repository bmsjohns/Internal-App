"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Location, Order, Supplier } from "@/lib/types";
import { fetchJson } from "@/lib/fetch-json";
import {
  canonicalStatus,
  CANONICAL_STATUSES,
  DELIVERY_METHODS,
  PAID_OPTIONS,
  TEAM_MEMBER_CHOICES,
  VENUES,
  venueKeyOf,
} from "@/lib/config";
import { useVenue } from "./VenueContext";
import { btnGhost, btnPrimary } from "./PageHeader";
import CustomerPicker, { type PickedCustomer } from "./CustomerPicker";

type Draft = {
  isbn: string;
  bookTitle: string;
  author: string;
  statusKey: string;
  paid: string;
  deliveryMethod: string;
  specialOrder: boolean;
  isPreorder: boolean;
  preorderPublicationDate: string;
  location: Location;
  notes: string;
  publisher: string;
  priceStr: string;
  quantity: number;
  teamMember: string; // "" = default to the logged-in user (server-side)
};

const emptyDraft = (location: Location): Draft => ({
  isbn: "",
  bookTitle: "",
  author: "",
  statusKey: "needs-ordering",
  paid: "Not Paid",
  deliveryMethod: "Collection",
  specialOrder: false,
  isPreorder: false,
  preorderPublicationDate: "",
  location,
  notes: "",
  publisher: "",
  priceStr: "",
  quantity: 1,
  teamMember: "",
});

const labelCls = "eyebrow mb-[7px] block text-charcoal";
const inputCls =
  "w-full rounded-md border border-cream-2 bg-white px-[13px] py-[11px] text-[14.5px] text-ink";
const segBtn = (active: boolean) =>
  `flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-1.5 py-2.5 text-[13px] font-semibold ${
    active ? "border-rust bg-shell text-rust" : "border-cream-2 bg-white text-charcoal"
  }`;

/**
 * Shared create/edit form (spec §4.3). Create mode is a continuous entry
 * session: "Save & add another" saves immediately as its own record, keeps
 * the customer/venue/defaults, clears the book fields and refocuses the
 * ISBN input — a stack of books is a scan-Enter loop.
 */
export default function OrderForm({
  order,
  customer,
}: {
  order?: Order;
  customer?: PickedCustomer;
}) {
  const editing = !!order;
  const router = useRouter();
  const { venue } = useVenue();
  const initialStatusKey = order ? canonicalStatus(order.status).key : "needs-ordering";
  const [draft, setDraft] = useState<Draft>(
    order
      ? {
          isbn: order.isbn,
          bookTitle: order.bookTitle,
          author: order.author,
          statusKey: initialStatusKey,
          paid: order.paid || "Not Paid",
          deliveryMethod: order.deliveryMethod || "Collection",
          specialOrder: order.specialOrder,
          isPreorder: order.isPreorder,
          preorderPublicationDate: order.preorderPublicationDate ?? "",
          location: order.location,
          notes: order.notes,
          publisher: order.publisher,
          priceStr: order.price != null ? String(order.price) : "",
          quantity: order.quantity,
          teamMember: order.teamMember,
        }
      : emptyDraft(venue === "prologue" ? "Prologue" : "Simply Books")
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierError, setSupplierError] = useState("");
  useEffect(() => {
    fetchJson<{ suppliers: Supplier[] }>("/api/suppliers")
      .then((d) => setSuppliers(d.suppliers))
      .catch((e) => setSupplierError(e instanceof Error ? e.message : "Couldn’t load suppliers"));
  }, []);
  const [picked, setPicked] = useState<PickedCustomer>(customer ?? null);
  const [added, setAdded] = useState<Order[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lookup, setLookup] = useState("");
  const isbnRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // Barcode scanners type the ISBN rapidly and finish with Enter/Tab
  // (spec §11a.7): intercept it, look the book up, and move focus on.
  async function lookupIsbn() {
    const isbn = draft.isbn.replace(/[^0-9Xx]/g, "");
    if (isbn.length < 10) return;
    setLookup("Looking up…");
    try {
      const res = await fetch(`/api/isbn/${isbn}`);
      if (res.ok) {
        const { book } = await res.json();
        setDraft((d) => ({ ...d, bookTitle: book.title, author: book.author }));
        setLookup(`✓ Matched — title & author filled below.`);
      } else {
        setLookup("Not found — type the title in");
        titleRef.current?.focus();
      }
    } catch {
      setLookup("Lookup failed — type the title in");
      titleRef.current?.focus();
    }
  }

  async function save(view: boolean) {
    setError("");
    if (!draft.bookTitle.trim()) {
      setError("Book title is required");
      titleRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const { statusKey, priceStr, ...rest } = draft;
      const price = priceStr.trim() === "" ? null : Number(priceStr);
      if (price !== null && (Number.isNaN(price) || price < 0)) {
        setError("Price must be a number");
        setBusy(false);
        return;
      }
      const payload: Record<string, unknown> = {
        ...rest,
        price,
        preorderPublicationDate: draft.isPreorder ? draft.preorderPublicationDate || null : null,
        customerIds: picked ? [picked.id] : [],
      };
      // Only rewrite Status when the canonical stage actually changed, so an
      // edit doesn't silently swap a legacy Airtable value for its writeAs
      // equivalent (e.g. "Ordered - In Basket" → "Ordered").
      if (!editing || statusKey !== initialStatusKey) {
        payload.status = CANONICAL_STATUSES.find((s) => s.key === statusKey)!.writeAs;
      }
      const res = await fetch(editing ? `/api/orders/${order!.id}` : "/api/orders", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (editing || view) {
        router.push(`/orders/${editing ? order!.id : data.order.id}`);
        router.refresh();
      } else {
        setAdded((a) => [{ ...data.order, customerName: picked?.name }, ...a]);
        setDraft((d) => ({
          ...emptyDraft(d.location),
          deliveryMethod: d.deliveryMethod,
          paid: d.paid,
        }));
        setLookup("");
        isbnRef.current?.focus();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-7 px-5 pb-10 pt-6 sm:px-8 lg:grid-cols-[1.4fr_.9fr]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
      >
        {/* scanner field */}
        <div className="flex items-center gap-4 rounded-lg bg-rust p-5 text-cream">
          <svg className="shrink-0" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
            <path d="M7 8v8M10 8v8M13 8v8M17 8v8" />
          </svg>
          <div className="flex-1">
            <label htmlFor="isbn" className="eyebrow mb-1.5 block opacity-85">
              Scan or type ISBN — then Enter
            </label>
            <div className="flex gap-2.5">
              <input
                id="isbn"
                ref={isbnRef}
                autoFocus={!editing}
                value={draft.isbn}
                onChange={(e) => set("isbn", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Tab") {
                    e.preventDefault();
                    lookupIsbn();
                  }
                }}
                inputMode="numeric"
                autoComplete="off"
                placeholder="978…"
                className="flex-1 rounded border-2 border-rust-deep bg-white px-[13px] py-[11px] font-mono text-base tracking-wide text-ink"
              />
              <button
                type="button"
                onClick={lookupIsbn}
                className="cursor-pointer rounded border-[1.5px] border-cream bg-transparent px-[18px] text-[13px] font-semibold text-cream"
              >
                Look up
              </button>
            </div>
            {lookup && <div className="mt-[7px] text-xs opacity-85">{lookup}</div>}
          </div>
        </div>

        {/* book fields */}
        <div className="mt-[22px] grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="title">
              Book title <span className="text-rust">*</span>
            </label>
            <input id="title" ref={titleRef} value={draft.bookTitle} onChange={(e) => set("bookTitle", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="author">
              Author
            </label>
            <input id="author" value={draft.author} onChange={(e) => set("author", e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="price">
                Price (£)
              </label>
              <input
                id="price"
                inputMode="decimal"
                placeholder="—"
                value={draft.priceStr}
                onChange={(e) => set("priceStr", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="qty">
                Quantity
              </label>
              <input
                id="qty"
                type="number"
                min={1}
                value={draft.quantity}
                onChange={(e) => set("quantity", Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                className={inputCls}
              />
            </div>
          </div>
          {/* V3 §6: the pre-order question comes BEFORE the date it makes relevant */}
          <div className="flex items-center gap-[22px] sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal">
              <input type="checkbox" checked={draft.specialOrder} onChange={(e) => set("specialOrder", e.target.checked)} className="h-4 w-4 accent-rust" />
              Special order
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal">
              <input type="checkbox" checked={draft.isPreorder} onChange={(e) => set("isPreorder", e.target.checked)} className="h-4 w-4 accent-rust" />
              Pre-order
            </label>
            {draft.isPreorder && (
              <label className="flex items-center gap-2">
                <span className="eyebrow text-charcoal">Pub. date</span>
                <input
                  type="date"
                  value={draft.preorderPublicationDate}
                  onChange={(e) => set("preorderPublicationDate", e.target.value)}
                  className="rounded-md border border-cream-2 bg-white px-2.5 py-2 text-sm text-ink"
                />
              </label>
            )}
          </div>
        </div>

        {/* customer */}
        <div className="mt-4">
          <label className={labelCls}>
            Customer <span className="normal-case tracking-normal text-stone">— match by phone or email</span>
          </label>
          <CustomerPicker value={picked} onChange={setPicked} />
        </div>

        {/* meta */}
        <div className="mt-[22px] grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="status">
              Status
            </label>
            <select id="status" value={draft.statusKey} onChange={(e) => set("statusKey", e.target.value)} className={`${inputCls} cursor-pointer`}>
              {CANONICAL_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            {supplierError && <p className="mb-0 mt-1 text-xs text-coral">Supplier list unavailable: {supplierError}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="paid">
              Paid?
            </label>
            <select id="paid" value={draft.paid} onChange={(e) => set("paid", e.target.value)} className={`${inputCls} cursor-pointer`}>
              {PAID_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Delivery method</label>
            <div className="flex gap-1.5">
              {DELIVERY_METHODS.map((d) => (
                <button key={d} type="button" onClick={() => set("deliveryMethod", d)} className={segBtn(draft.deliveryMethod === d)}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Location</label>
            <div className="flex gap-1.5">
              {(Object.keys(VENUES) as (keyof typeof VENUES)[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set("location", VENUES[k].label)}
                  className={segBtn(venueKeyOf(draft.location) === k)}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: VENUES[k].color }} />
                  {VENUES[k].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="teamMember">
              Team member
            </label>
            <select
              id="teamMember"
              value={draft.teamMember}
              onChange={(e) => set("teamMember", e.target.value)}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">{editing ? "Unassigned" : "Me (default)"}</option>
              {TEAM_MEMBER_CHOICES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="publisher">
              Supplier <span className="normal-case tracking-normal text-stone">(usually set when ordering)</span>
            </label>
            <select
              id="publisher"
              value={draft.publisher}
              onChange={(e) => set("publisher", e.target.value)}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">Not set</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
              {draft.publisher && !suppliers.some((s) => s.name === draft.publisher) && (
                <option value={draft.publisher}>{draft.publisher}</option>
              )}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="notes">
              Notes
            </label>
            <textarea id="notes" rows={2} value={draft.notes} onChange={(e) => set("notes", e.target.value)} className={inputCls} />
          </div>
        </div>

        {error && <p className="mt-4 text-sm font-semibold text-coral">{error}</p>}

        <div className="mt-[26px] flex gap-2.5">
          {editing ? (
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? "Saving…" : "Save changes"}
            </button>
          ) : (
            <>
              <button type="submit" disabled={busy} className={btnPrimary}>
                {busy ? "Saving…" : "Save & add another"}
              </button>
              <button type="button" disabled={busy} onClick={() => save(true)} className={btnGhost}>
                Save & view
              </button>
            </>
          )}
        </div>
      </form>

      {/* right column: this session */}
      {!editing && (
        <div>
          <div className="overflow-hidden rounded-lg border border-cream-2 bg-white lg:sticky lg:top-6">
            <div className="flex items-center justify-between border-b border-cream-2 px-[18px] py-3.5">
              <div className="font-display text-[17px]">This session</div>
              <span className="text-[11px] text-stone">{added.length} added</span>
            </div>
            <div className="max-h-[340px] overflow-auto">
              {added.length === 0 && (
                <p className="px-[18px] py-4 text-[13px] text-stone">Nothing saved yet this visit.</p>
              )}
              {added.map((o) => (
                <div key={o.id} className="flex items-start gap-[11px] border-b border-cream-2 px-[18px] py-3">
                  <svg className="mt-px shrink-0 text-moss" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
                  </svg>
                  <div className="flex-1 leading-snug">
                    <div className="text-[13.5px] font-semibold">{o.bookTitle}</div>
                    <div className="text-xs text-stone">
                      {[o.author, o.customerName].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2.5 bg-shell px-[18px] py-[13px]">
              <Image src="/assets/bird-reading.png" alt="" width={44} height={40} className="h-auto w-11 shrink-0" />
              <p className="m-0 text-[12.5px] leading-snug text-rust">
                Keep scanning — each book saves as its own order. We keep the customer until you change it.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
