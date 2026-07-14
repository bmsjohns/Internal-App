"use client";

import Link from "next/link";

/** Screen header: eyebrow + New Spirit title over the brand-red rule. */
export default function PageHeader({
  eyebrow,
  title,
  backHref,
  actions,
  children,
  compact,
}: {
  eyebrow: string;
  title: string;
  backHref?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <header className={`border-b-[1.5px] border-rust px-5 pb-[18px] sm:px-8 ${compact ? "pt-[22px]" : "pt-[26px]"}`}>
      <div className="flex flex-wrap items-center gap-3.5">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded px-2.5 py-2 text-[13px] font-semibold text-charcoal hover:bg-ink/5"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Queue
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="eyebrow mb-1.5 text-rust">{eyebrow}</div>
          <h1 className={`m-0 leading-none tracking-[-0.02em] ${compact ? "text-[28px]" : "text-[34px]"}`}>{title}</h1>
        </div>
        {actions && <div className="flex items-center gap-2.5">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export const btnPrimary =
  "inline-flex items-center gap-1.5 rounded border-[1.5px] border-rust bg-rust px-[17px] py-2.5 text-[13px] font-semibold text-cream hover:bg-rust-deep hover:border-rust-deep cursor-pointer disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center gap-1.5 rounded border-[1.5px] border-cream-2 bg-white px-[15px] py-[9px] text-[13px] font-semibold text-charcoal hover:border-ink hover:text-ink cursor-pointer disabled:opacity-50";
