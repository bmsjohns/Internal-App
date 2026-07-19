"use client";

import { useEffect, useRef, useState } from "react";

// In-app camera barcode scanning (spec: "scope feasibility and propose an
// approach"). The approach: the browser-native BarcodeDetector API over a
// getUserMedia feed — zero dependencies, decodes EAN-13 (every book barcode)
// live on Chrome/Edge/Android tablets. Where the API is missing (notably
// iOS Safari) the overlay says so plainly and points at the USB/Bluetooth
// scanner path, which works everywhere the keyboard does. Swapping in a
// WASM decoder (e.g. zxing-wasm) later would close the iOS gap — noted in
// the README, not worth a dependency until someone actually scans from an
// iPhone.

type DetectorCtor = new (opts: { formats: string[] }) => {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
};

const getDetector = (): DetectorCtor | null =>
  typeof window !== "undefined" && "BarcodeDetector" in window
    ? (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector
    : null;

export default function CameraScanner({
  hint,
  onScan,
  onClose,
}: {
  hint: string;
  /** Called with each decoded ISBN (deduped); scanner stays open for the next book. */
  onScan: (isbn: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"starting" | "scanning" | "unsupported" | "denied">("starting");
  const [lastScan, setLastScan] = useState("");

  useEffect(() => {
    const Detector = getDetector();
    if (!Detector) {
      setState("unsupported");
      return;
    }
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    let lastValue = "";
    let lastAt = 0;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        if (!stopped) setState("denied");
        return;
      }
      if (stopped || !videoRef.current) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
      setState("scanning");
      const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a"] });
      timer = setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        try {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue?.replace(/[^0-9Xx]/g, "") ?? "";
          if (!value || value.length < 8) return;
          // Debounce: the same barcode sits in frame for many detect ticks.
          const now = Date.now();
          if (value === lastValue && now - lastAt < 1500) return;
          lastValue = value;
          lastAt = now;
          setLastScan(value);
          onScan(value);
        } catch {
          // detect() can throw while the feed warms up — just try again.
        }
      }, 220);
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[rgba(20,17,13,0.92)] p-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="text-cream">
            <div className="font-display text-xl">Scan a barcode</div>
            <div className="text-[12.5px] opacity-70">{hint}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-full border-none bg-white/10 text-white hover:bg-white/20"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-[#15120f]">
          {state !== "unsupported" && state !== "denied" && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
          )}
          {state === "scanning" && (
            <>
              <div className="absolute inset-x-[8%] inset-y-[30%] rounded-[10px] border-2 border-cream/85 shadow-[0_0_0_100vmax_rgba(20,17,13,0.35)]" />
              <div className="rt-scanline absolute inset-x-[8%] h-[2.5px] bg-coral shadow-[0_0_12px_2px_var(--color-coral)]" />
              <div className="absolute inset-x-0 bottom-4 text-center text-xs text-cream/70">
                Align the barcode within the frame
                {lastScan && <span className="mt-1 block font-semibold tabular-nums text-cream">Last scan · {lastScan}</span>}
              </div>
            </>
          )}
          {state === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-cream/70">Starting camera…</div>
          )}
          {(state === "unsupported" || state === "denied") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#F5ADB0" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h3l2-2h6l2 2h3v11H4z" />
                <path d="M4 4l16 16" />
              </svg>
              <div className="text-sm font-semibold text-cream">
                {state === "denied" ? "Camera access was blocked" : "This browser can't decode barcodes in-page"}
              </div>
              <p className="text-[12.5px] leading-relaxed text-cream/70">
                {state === "denied"
                  ? "Allow camera access in the browser's site settings and try again — or use a USB / Bluetooth scanner, which works in any input field."
                  : "A USB / Bluetooth barcode scanner still works everywhere — click into the scan field and scan as normal. Camera decoding needs Chrome or Edge (or an Android tablet)."}
              </p>
            </div>
          )}
        </div>

        <div className="mt-2.5 text-center text-[11.5px] text-cream/55">
          Scans land instantly — keep going, one book after another. Close when the pile&apos;s done.
        </div>
      </div>
    </div>
  );
}
