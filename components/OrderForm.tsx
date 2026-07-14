"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Location, Order } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";
import { DELIVERY_METHODS, PAID_OPTIONS, STATUS_GROUPS } from "@/lib/config";
import CustomerPicker, { type PickedCustomer } from "./CustomerPicker";

type Draft = {
  isbn: string;
  bookTitle: string;
  author: string;
  status: string;
  paid: string;
  deliveryMethod: string;
  specialOrder: boolean;
  isPreorder: boolean;
  preorderPublicationDate: string;
  location: Location;
  notes: string;
};

const emptyDraft = (location: Location): Draft => ({
  isbn: "",
  bookTitle: "",
  author: "",
  status: "Not Ordered",
  paid: "Not Paid",
  deliveryMethod: "Collection",
  specialOrder: true,
  isPreorder: false,
  preorderPublicationDate: "",
  location,
  notes: "",
});

function fromOrder(o: Order): Draft {
  return {
    isbn: o.isbn,
    bookTitle: o.bookTitle,
    author: o.author,
    status: o.status,
    paid: o.paid,
    deliveryMethod: o.deliveryMethod,
    specialOrder: o.specialOrder,
    isPreorder: o.isPreorder,
    preorderPublicationDate: o.preorderPublicationDate ?? "",
    location: o.location,
    notes: o.notes,
  };
}

/**
 * Shared create/edit form (spec §4.3). Create mode is a continuous entry
 * session: each "Add order" saves immediately as its own record, keeps the
 * customer/venue/defaults, clears the book fields, and refocuses the ISBN
 * input — so a stack of books for one customer is a scan-Enter loop.
 */
export default function OrderForm({
  order,
  customer,
  canDelete,
}: {
  order?: Order;
  customer?: PickedCustomer;
  canDelete?: boolean;
}) {
  const editing = !!order;
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(order ? fromOrder(order) : emptyDraft("Simply Books"));
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
        setLookup(`Found: ${book.title}`);
      } else {
        setLookup("Not found — type the title in");
        titleRef.current?.focus();
      }
    } catch {
      setLookup("Lookup failed — type the title in");
      titleRef.current?.focus();
    }
  }

  async function save() {
    setError("");
    if (!draft.bookTitle.trim()) {
      setError("Book title is required");
      titleRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...draft,
        preorderPublicationDate: draft.isPreorder ? draft.preorderPublicationDate || null : null,
        customerIds: picked ? [picked.id] : [],
      };
      const res = await fetch(editing ? `/api/orders/${order!.id}` : "/api/orders", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (editing) {
        router.push("/orders");
        router.refresh();
      } else {
        setAdded((a) => [{ ...data.order, customerName: picked?.name }, ...a]);
        setDraft((d) => ({ ...emptyDraft(d.location), deliveryMethod: d.deliveryMethod, paid: d.paid }));
        setLookup("");
        isbnRef.current?.focus();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!order) return;
    if (!confirm(`Delete the order for “${order.bookTitle}”? This can’t be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/orders");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Delete failed");
      setBusy(false);
    }
  }

  const input = "w-full rounded-md border border-ink/20 px-3 py-2 text-sm";
  const label = "block text-xs font-semibold uppercase tracking-wide text-ink/50 mb-1";

  return (
    <div className="max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4"
      >
        <div className="rounded-lg border border-ink/15 bg-white p-4 space-y-4">
          <div>
            <label className={label} htmlFor="isbn">ISBN — scan or type, then Enter</label>
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
              placeholder="9780000000000"
              className={`${input} font-mono`}
            />
            {lookup && <p className="mt-1 text-xs text-ink/60">{lookup}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="title">Book title *</label>
              <input id="title" ref={titleRef} value={draft.bookTitle} onChange={(e) => set("bookTitle", e.target.value)} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="author">Author</label>
              <input id="author" value={draft.author} onChange={(e) => set("author", e.target.value)} className={input} />
            </div>
          </div>

          <div>
            <label className={label}>Customer</label>
            <CustomerPicker value={picked} onChange={setPicked} />
          </div>
        </div>

        <div className="rounded-lg border border-ink/15 bg-white p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className={label} htmlFor="status">Status</label>
              <select id="status" value={draft.status} onChange={(e) => set("status", e.target.value)} className={input}>
                {STATUS_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.statuses.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="paid">Paid</label>
              <select id="paid" value={draft.paid} onChange={(e) => set("paid", e.target.value)} className={input}>
                {PAID_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="delivery">Delivery</label>
              <select id="delivery" value={draft.deliveryMethod} onChange={(e) => set("deliveryMethod", e.target.value)} className={input}>
                {DELIVERY_METHODS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="venue">Venue</label>
              <select id="venue" value={draft.location} onChange={(e) => set("location", e.target.value as Location)} className={input}>
                {LOCATIONS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.specialOrder} onChange={(e) => set("specialOrder", e.target.checked)} />
              Special order
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={draft.isPreorder} onChange={(e) => set("isPreorder", e.target.checked)} />
              Pre-order
            </label>
            {draft.isPreorder && (
              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-ink/50">Publication date</span>
                <input
                  type="date"
                  value={draft.preorderPublicationDate}
                  onChange={(e) => set("preorderPublicationDate", e.target.value)}
                  className="rounded-md border border-ink/20 px-2 py-1.5 text-sm"
                />
              </label>
            )}
          </div>

          <div className="mt-4">
            <label className={label} htmlFor="notes">Notes</label>
            <textarea id="notes" rows={2} value={draft.notes} onChange={(e) => set("notes", e.target.value)} className={input} />
          </div>
        </div>

        {error && <p className="text-sm font-medium text-coral">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-rust px-5 py-2.5 text-sm font-semibold text-paper hover:bg-rust-dark disabled:opacity-50"
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Add order"}
          </button>
          {editing && canDelete && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral hover:bg-shell disabled:opacity-50"
            >
              Delete order
            </button>
          )}
        </div>
      </form>

      {added.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Added this session</h2>
          <ul className="mt-2 divide-y divide-ink/10 rounded-lg border border-ink/15 bg-white text-sm">
            {added.map((o) => (
              <li key={o.id} className="flex items-baseline gap-2 px-3 py-2">
                <span className="font-medium">{o.bookTitle}</span>
                <span className="text-ink/60">{o.author}</span>
                {o.customerName && <span className="ml-auto text-ink/60">{o.customerName}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
