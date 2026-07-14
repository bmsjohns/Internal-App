"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteOrderButton({ orderId, bookTitle }: { orderId: string; bookTitle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Delete the order for “${bookTitle}”? This can’t be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/orders");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Delete failed");
      setBusy(false);
    }
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded border-[1.5px] border-rust bg-transparent px-[15px] py-[9px] text-[13px] font-semibold text-rust hover:bg-shell disabled:opacity-50"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      </svg>
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
