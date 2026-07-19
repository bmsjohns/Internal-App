"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function EventError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Event page render failed", error);
  }, [error]);

  return (
    <div className="ob-screen flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-[560px] rounded-[14px] border border-cream-2 bg-white px-6 py-10 text-center shadow-[0_12px_40px_rgba(44,37,32,0.06)] sm:px-10">
        <div className="eyebrow mb-3 text-rust">Event recovery</div>
        <h1 className="font-display text-3xl text-charcoal">This event hit an unexpected display problem</h1>
        <p className="mx-auto mt-3 max-w-[440px] text-[13.5px] leading-relaxed text-stone">
          The event record is safe. Retry the page, or return to Events while Backstage falls back from the external ticket feed.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button onClick={reset} className="rounded-md bg-rust px-5 py-2.5 text-[13px] font-semibold text-cream">Retry event</button>
          <Link href="/events" className="rounded-md border border-rust bg-white px-5 py-2.5 text-[13px] font-semibold text-rust">Back to Events</Link>
        </div>
      </div>
    </div>
  );
}
