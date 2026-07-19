"use client";

import { useEffect, useState } from "react";
import type { ReturnRequest, ReturnStatus } from "@/lib/types";
import { returnStatusMeta } from "@/lib/returns";
import { Tag } from "@/components/clubs/ui";

// Shared visual language for the Returns module, from the Claude Design file
// "Returns.dc.html". Status pills are tinted like the Hub's state tags;
// origin gets its own pill (event = plum ticket, general = warm neutral) so
// the queue reads at a glance; line items always carry a small cover.

export function ReturnStatusPill({ status }: { status: ReturnStatus }) {
  const m = returnStatusMeta(status);
  return <Tag label={m.label} color={m.color} bg={m.bg} dot={false} />;
}

export function OriginPill({ r }: { r: Pick<ReturnRequest, "origin"> }) {
  if (r.origin === "event") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#F0E7F3] px-2.5 py-1 text-xs font-semibold text-[#7A4E8C]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8a2 2 0 012-2h12a2 2 0 012 2 2 2 0 000 4 2 2 0 010 4H6a2 2 0 01-2-2 2 2 0 000-4z" />
        </svg>
        Event
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap rounded-full bg-[#EDE8DF] px-2.5 py-1 text-xs font-semibold text-[#6E665C]">
      General stock
    </span>
  );
}

/**
 * Small line-item cover — the Orders cover-lookup pattern (OpenLibrary, V3
 * §6) at list size, with the same visible data-quality warning when nothing
 * resolves: a failed lookup often means a mistyped ISBN.
 */
export function LineCover({ isbn, title, width = 36, height = 50 }: { isbn: string; title: string; width?: number; height?: number }) {
  const [state, setState] = useState<"loading" | "ok" | "missing">(isbn ? "loading" : "missing");
  const src = `https://covers.openlibrary.org/b/isbn/${isbn.replace(/[^0-9Xx]/g, "")}-M.jpg?default=false`;

  useEffect(() => {
    setState(isbn ? "loading" : "missing");
  }, [isbn]);

  if (!isbn || state === "missing") {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-[3px] border-[1.5px] border-dashed border-ochre/60 bg-[#FBF6E6]"
        style={{ width, height }}
        title={isbn ? "No cover found — double-check the ISBN" : "No ISBN"}
      >
        <svg width={Math.min(18, width - 14)} height={Math.min(18, width - 14)} viewBox="0 0 24 24" fill="none" stroke="#B0812F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3.5l9 16.5H3z" />
          <path d="M12 10v4M12 16.5v.5" />
        </svg>
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Cover of ${title}`}
      className="shrink-0 rounded-[3px] border border-cream-2 object-cover shadow-sm"
      style={{ width, height, background: "#fff" }}
      onLoad={() => setState("ok")}
      onError={() => setState("missing")}
    />
  );
}

/** Quantity stepper matching the Hub's staging control. */
export function QtyStepper({ value, onChange, size = "md" }: { value: number; onChange: (n: number) => void; size?: "sm" | "md" }) {
  const pad = size === "sm" ? "px-2.5 py-1.5" : "px-3.5 py-3";
  const mid = size === "sm" ? "min-w-[34px] py-1.5" : "min-w-[44px] py-3";
  return (
    <span className="inline-flex items-center overflow-hidden rounded-lg border border-cream-2 bg-white">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} className={`cursor-pointer border-none bg-transparent text-[15px] text-charcoal hover:bg-cream ${pad}`}>
        –
      </button>
      <span className={`border-x border-cream-2 text-center text-sm font-semibold tabular-nums ${mid}`}>{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} className={`cursor-pointer border-none bg-transparent text-[15px] text-charcoal hover:bg-cream ${pad}`}>
        +
      </button>
    </span>
  );
}

/** Ghost secondary button (design: rt-btn-ghost). */
export function GhostButton({ children, onClick, disabled, title }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-[1.5px] border-cream-2 bg-transparent px-3.5 py-2 text-[13px] font-semibold text-charcoal hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
