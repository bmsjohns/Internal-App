"use client";

import { useEffect, useState } from "react";

// V3 §6: cover from the ISBN (OpenLibrary covers, no key needed), with a
// visible warning — not just a blank placeholder — when nothing resolves,
// since a failed lookup often means the ISBN was mistyped.
export default function BookCover({ isbn, title }: { isbn: string; title: string }) {
  const [state, setState] = useState<"loading" | "ok" | "missing">(isbn ? "loading" : "missing");
  const src = `https://covers.openlibrary.org/b/isbn/${isbn.replace(/[^0-9Xx]/g, "")}-M.jpg?default=false`;

  useEffect(() => {
    setState(isbn ? "loading" : "missing");
  }, [isbn]);

  if (!isbn || state === "missing") {
    return (
      <div className="flex h-44 w-30 shrink-0 flex-col items-center justify-center gap-2 rounded border border-dashed border-ochre/60 bg-white p-3 text-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B0812F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l9 16H3z" />
          <path d="M12 10v4M12 17h.01" />
        </svg>
        <span className="text-[11px] font-semibold leading-snug text-ochre">
          {isbn ? "No cover found — double-check the ISBN" : "No ISBN on this order"}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Cover of ${title}`}
      className={`h-44 w-auto shrink-0 rounded border border-cream-2 object-contain shadow-sm ${state === "loading" ? "bg-white" : ""}`}
      onLoad={() => setState("ok")}
      onError={() => setState("missing")}
    />
  );
}
