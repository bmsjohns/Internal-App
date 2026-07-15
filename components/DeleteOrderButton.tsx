"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnDanger } from "./PageHeader";

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
      className={btnDanger}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      </svg>
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
