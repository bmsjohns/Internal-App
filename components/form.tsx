// Field styling from the design file ("Order Book.dc.html"): 10px caps
// labels, 6px-radius inputs, chevroned selects. Shared by the Events module
// screens (the pitching editor carries its own copy from Phase 1).
export const labelCls = "eyebrow mb-[7px] block text-charcoal";
export const inputCls =
  "w-full rounded-md border border-cream-2 bg-white px-[13px] py-[11px] text-[14.5px] text-ink disabled:opacity-60";
export const selectWrap = "relative";
export const selectCls = `${inputCls} cursor-pointer appearance-none pr-[34px]`;
export const textareaCls = `${inputCls} min-h-[84px] resize-y leading-normal`;
export const panelCls = "rounded-lg border border-cream-2 bg-white px-5 py-[18px]";
export const panelHead = "eyebrow mb-3 block text-stone";

export const Chevron = ({ top = 17 }: { top?: number }) => (
  <svg
    className="pointer-events-none absolute right-3 text-stone"
    style={{ top }}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);
