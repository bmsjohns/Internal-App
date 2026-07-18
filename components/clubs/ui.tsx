"use client";

import { useVenue } from "@/components/VenueContext";
import { avatarColor } from "@/lib/clubs";
import { initialsOf, VENUES } from "@/lib/config";
import type { Location } from "@/lib/types";

// Shared visual language for Book Clubs + Ordering Hub, from the Claude
// Design file "Book Clubs & Ordering Hub.dc.html": the whole surface
// re-tints to the venue being viewed (teal for Simply Books, terracotta
// otherwise), status pills are dot+tint, members get warm generated avatars.

export function useAccent() {
  const { venue } = useVenue();
  const simply = venue === "simply";
  return {
    venue,
    accent: simply ? VENUES.simply.color : VENUES.prologue.color,
    accentSoft: simply ? "#E4F0EC" : "#FBEDEA",
  };
}

export const venueColor = (location: Location) =>
  location === "Simply Books" ? VENUES.simply.color : VENUES.prologue.color;

/** Dot + tinted pill (design: statusTag / payTag / orderStateTag). */
export function Tag({ label, color, bg, dot = true }: { label: string; color: string; bg: string; dot?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color, background: bg }}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
      {label}
    </span>
  );
}

/** Small source badge (no dot) — Book Club / Event / School / Customer. */
export function SourceBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color, background: bg }}>
      {label}
    </span>
  );
}

export function MemberAvatar({ name, size = 34, teal = false, ring = false }: { name: string; size?: number; teal?: boolean; ring?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display text-white ${ring ? "border-2 border-cream" : ""}`}
      style={{ width: size, height: size, background: avatarColor(name, teal), fontSize: Math.round(size * 0.38) }}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Accent-aware screen header (design: eyebrow over display title, 1.5px
 *  accent rule). PageHeader stays rust-only for the older modules. */
export function ModuleHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  backLabel,
  onBack,
}: {
  eyebrow: string;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  backLabel?: string;
  onBack?: () => void;
}) {
  const { accent } = useAccent();
  return (
    <header className="px-5 pt-5 sm:px-8" style={{ borderBottom: `1.5px solid ${accent}` }}>
      {onBack && (
        <button
          onClick={onBack}
          className="mb-2 -ml-2 inline-flex cursor-pointer items-center gap-1.5 rounded border-none bg-transparent px-2 py-1.5 text-[13px] font-semibold text-charcoal hover:bg-ink/5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {backLabel}
        </button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
        <div className="min-w-0">
          <div className="eyebrow mb-1.5" style={{ color: accent }}>
            {eyebrow}
          </div>
          <h1 className="m-0 text-[30px] leading-none tracking-[-0.02em] sm:text-[36px]">{title}</h1>
          {subtitle && <p className="mt-2 max-w-[680px] text-sm text-charcoal">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2.5">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** Accent-filled primary button matching the header tint. */
export function AccentButton({
  children,
  onClick,
  disabled,
  title,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
}) {
  const { accent } = useAccent();
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded border-[1.5px] px-[17px] py-2.5 text-[13px] font-semibold text-cream hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
      style={{ background: accent, borderColor: accent }}
    >
      {children}
    </button>
  );
}

/** Modal overlay card (design: overlays — dimmed backdrop, cream card). */
export function Overlay({ onClose, width = 560, children }: { onClose: () => void; width?: number; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,23,20,0.42)] p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ob-screen max-h-[88vh] w-full overflow-auto rounded-2xl bg-cream shadow-2xl"
        style={{ maxWidth: width }}
      >
        {children}
      </div>
    </div>
  );
}

export function OverlayHead({ title, sub, onClose }: { title: string; sub?: React.ReactNode; onClose: () => void }) {
  return (
    <div className="border-b border-cream-2 px-6 py-5">
      <button onClick={onClose} className="float-right cursor-pointer border-none bg-transparent text-stone hover:text-ink" aria-label="Close">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <h3 className="m-0 font-display text-2xl tracking-[-0.01em]">{title}</h3>
      {sub && <p className="mt-1 text-[13px] text-charcoal">{sub}</p>}
    </div>
  );
}

/** Bottom-centre toast (design: toast). */
export function Toast({ text }: { text: string }) {
  return (
    <div className="ob-screen fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-[13.5px] font-semibold text-cream shadow-xl">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      {text}
    </div>
  );
}
