"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { VenueKey } from "@/lib/config";
import { BRIEFING_VENUES } from "@/lib/briefing";
import { useVenue } from "@/components/VenueContext";
import type { DashboardOpsCard, DashboardPayload, DashboardTile, DashboardTrendCard } from "@/lib/dashboard";
import { gbp } from "@/lib/dashboard";
import type { SalesPeriodKey, VenueSalesReport } from "@/lib/data/sales-source";
import { SALES_PERIODS } from "@/lib/data/sales-source";
import { Bars, Chip, DeltaPill, ICONS, LineChart, Spark, TrendDeltaPill, icon } from "@/components/dashboard/charts";

// Management Dashboard — leadership/decision-support view for Ben & SLT
// (management-dashboard-spec.md; layout and visual language from the Claude
// Design file "Management Dashboard.dc.html", a deliberate sibling of the
// Daily Briefing). Three tiers: quick-look tiles, Sales (the anchor),
// Operational + Trend zones.

const COMBINED = "#3A322C";

const TILE_META: Record<DashboardTile["key"], { icon: string; accent: string; tint: string; href: string }> = {
  "returns-pick": { icon: ICONS.ret, accent: "#AD3B28", tint: "#FBEDEA", href: "/returns/picklists" },
  "orders-today": { icon: ICONS.receipt, accent: "#8A6410", tint: "#FBF1DA", href: "/to-order" },
  "failed-payments": { icon: ICONS.card, accent: "#B23A2A", tint: "#FBE3DF", href: "/failed-payments" },
  "hub-drafts": { icon: ICONS.send, accent: "#378573", tint: "#E4F0EC", href: "/ordering/staging" },
  "events-week": { icon: ICONS.calendar, accent: "#AD3B28", tint: "#FBEDEA", href: "/events" },
  pitches: { icon: ICONS.inbox, accent: "#7A4E8C", tint: "#F0E7F3", href: "/pitching" },
};

const OPS_META: Record<DashboardOpsCard["key"], { icon: string; accent: string; tint: string; href: string }> = {
  orders: { icon: ICONS.receipt, accent: "#8A6410", tint: "#FBF1DA", href: "/to-order" },
  hub: { icon: ICONS.send, accent: "#378573", tint: "#E4F0EC", href: "/ordering/staging" },
  returns: { icon: ICONS.ret, accent: "#AD3B28", tint: "#FBEDEA", href: "/returns" },
  clubs: { icon: ICONS.card, accent: "#B23A2A", tint: "#FBE3DF", href: "/failed-payments" },
  events: { icon: ICONS.calendar, accent: "#AD3B28", tint: "#FBEDEA", href: "/events" },
  restock: { icon: ICONS.box, accent: "#6B4A3A", tint: "#EFE7DF", href: "/ordering/restock" },
  staffing: { icon: ICONS.users, accent: "#378573", tint: "#E4F0EC", href: "/briefing" },
};

const TREND_META: Record<DashboardTrendCard["key"], { icon: string; accent: string; tint: string }> = {
  membership: { icon: ICONS.users, accent: "#378573", tint: "#E4F0EC" },
  turnaround: { icon: ICONS.clock, accent: "#AD3B28", tint: "#FBEDEA" },
  "returns-value": { icon: ICONS.ret, accent: "#8B2D1E", tint: "#FBEDEA" },
  margin: { icon: ICONS.tag, accent: "#6B4A3A", tint: "#EFE7DF" },
};

const CAT_COLORS: Record<string, string> = { retail: "#AD3B28", cafe: "#6B4A3A", bar: "#8B2D1E", events: "#7A4E8C" };

const combined = (f: { square: number; stripe: number | null }) => f.square + (f.stripe ?? 0);
const prevCombined = (f: { prevSquare: number; prevStripe: number | null }) => f.prevSquare + (f.prevStripe ?? 0);

function SectionHead({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-[18px] flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-rust">{eyebrow}</div>
        <h2 className="mt-[3px] font-display text-[27px] tracking-[-.01em]">{title}</h2>
      </div>
      {aside && <span className="text-[12.5px] text-stone">{aside}</span>}
    </div>
  );
}

function SalesCard({ report }: { report: VenueSalesReport }) {
  const theme = BRIEFING_VENUES[report.venue];
  const month = report.periods.month;
  return (
    <div className="overflow-hidden rounded-[10px] border border-cream-2 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3.5 px-5 py-[15px]" style={{ background: theme.accent }}>
        <span
          role="img"
          aria-label={theme.name}
          className="block shrink-0 bg-contain bg-left bg-no-repeat"
          style={{ width: theme.wmW, height: theme.wmH, backgroundImage: `url(${theme.wordmark})` }}
        />
        <div className="text-right leading-[1.05]">
          <div className="font-display text-[23px] text-cream">{gbp(combined(month))}</div>
          <div className="text-[9.5px] uppercase tracking-[.12em]" style={{ color: theme.soft }}>
            Month to date · combined
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 pt-1.5 sm:px-[18px]">
        <div className="grid grid-cols-[56px_repeat(3,1fr)] gap-x-2 py-2 text-[9.5px] font-bold uppercase tracking-[.1em] text-stone sm:grid-cols-[64px_repeat(3,1fr)]">
          <span />
          <span className="text-right">Square</span>
          <span className="text-right">Stripe</span>
          <span className="text-right">Combined</span>
        </div>
        {SALES_PERIODS.map((p) => {
          const f = report.periods[p.key];
          return (
            <div key={p.key} className="grid grid-cols-[56px_repeat(3,1fr)] items-center gap-x-2 border-t border-cream-2 py-[11px] sm:grid-cols-[64px_repeat(3,1fr)]">
              <div className="text-xs font-semibold text-charcoal">{p.label.replace(" to date", "")}</div>
              <div className="py-0.5 text-right">
                <div className="font-display text-base leading-[1.1] tabular-nums text-ink">{gbp(f.square)}</div>
                <DeltaPill cur={f.square} prev={f.prevSquare} />
              </div>
              <div className="py-0.5 text-right">
                {f.stripe == null ? (
                  <>
                    <div className="font-display text-base text-stone">—</div>
                    <div className="mt-0.5 text-[9.5px] text-stone">Not connected</div>
                  </>
                ) : (
                  <>
                    <div className="font-display text-base leading-[1.1] tabular-nums text-ink">{gbp(f.stripe)}</div>
                    <DeltaPill cur={f.stripe} prev={f.prevStripe} />
                  </>
                )}
              </div>
              <div className="py-0.5 text-right">
                <div className="font-display text-lg leading-[1.1] tabular-nums" style={{ color: theme.accent }}>
                  {gbp(combined(f))}
                </div>
                <DeltaPill cur={combined(f)} prev={prevCombined(f)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OpsCard({ card }: { card: DashboardOpsCard }) {
  const meta = OPS_META[card.key];
  return (
    <div className="flex flex-col rounded-xl border border-cream-2 bg-white px-5 pb-1.5 pt-[18px] shadow-sm">
      <div className="flex items-center gap-[11px] pb-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: meta.tint, color: meta.accent }}>
          {icon(meta.icon)}
        </span>
        <div className="min-w-0 flex-1 font-display text-[17px] leading-[1.15]">{card.title}</div>
        {card.count && (
          <span className="rounded-full px-2.5 py-[3px] text-[11px] font-bold tabular-nums" style={{ background: meta.tint, color: meta.accent }}>
            {card.count}
          </span>
        )}
      </div>
      {card.rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3.5 border-t border-cream-2 py-[13px]">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold leading-[1.3] text-ink">{r.main}</div>
            {r.sub && <div className="mt-0.5 text-xs text-stone">{r.sub}</div>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-[5px]">
            {r.right && <span className="whitespace-nowrap text-[15px] font-bold tabular-nums text-ink">{r.right}</span>}
            {r.chip && <Chip text={r.chip.text} tone={r.chip.tone} />}
          </div>
        </div>
      ))}
      <Link
        href={meta.href}
        className="mt-auto inline-flex items-center gap-1.5 self-start pb-[13px] pt-3.5 text-[12.5px] font-semibold text-rust hover:underline"
      >
        {card.linkLabel}
        {icon(ICONS.arrowR, 15)}
      </Link>
    </div>
  );
}

function TrendCard({ card }: { card: DashboardTrendCard }) {
  const meta = TREND_META[card.key];
  return (
    <div className="rounded-[10px] border border-cream-2 bg-white px-5 pb-[18px] pt-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg" style={{ background: meta.tint, color: meta.accent }}>
          {icon(meta.icon, 17)}
        </span>
        <h3 className="font-display text-base leading-[1.2]">{card.title}</h3>
      </div>
      {card.kpi && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="font-display text-[30px] leading-none text-ink">{card.kpi.value}</div>
            <div className="mt-1 text-[11.5px] text-stone">{card.kpi.label}</div>
          </div>
          {card.kpi.delta && <TrendDeltaPill delta={card.kpi.delta} />}
        </div>
      )}
      {card.chart.type === "spark" ? <Spark data={card.chart.data} color={meta.accent} /> : <Bars items={card.chart.items} color={meta.accent} />}
      {card.foot && <div className="mt-3 border-t border-cream-2 pt-[11px] text-[11.5px] text-stone">{card.foot}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { venue } = useVenue();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "forbidden" | "error">("loading");
  const [catPeriod, setCatPeriod] = useState<SalesPeriodKey>("month");
  const [syncedAt, setSyncedAt] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("md-cat-period");
      if (saved === "day" || saved === "week" || saved === "month") setCatPeriod(saved);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetch(`/api/dashboard?venue=${venue}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 403) return setStatus("forbidden");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const payload: DashboardPayload = await r.json();
        setData(payload);
        setSyncedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }).replace(":", "."));
        setStatus("ok");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [venue]);

  const pickCatPeriod = (p: SalesPeriodKey) => {
    setCatPeriod(p);
    try {
      localStorage.setItem("md-cat-period", p);
    } catch {}
  };

  const single = data?.sales.length === 1 ? data.sales[0] : null;
  const scope = single ? BRIEFING_VENUES[single.venue] : null;

  // Hero: month-to-date combined across the visible scope.
  const hero = useMemo(() => {
    if (!data || data.sales.length === 0) return null;
    const cur = data.sales.reduce((s, r) => s + combined(r.periods.month), 0);
    const prev = data.sales.reduce((s, r) => s + prevCombined(r.periods.month), 0);
    return { cur, prev };
  }, [data]);

  const chart = useMemo(() => {
    if (!data || data.sales.length === 0) return null;
    const daily = data.sales.map((r) => r.daily);
    const labels = [0, 7, 14, 21, 27]
      .filter((i) => i < (daily[0]?.length ?? 0))
      .map((idx) => ({
        idx,
        t: new Date(`${daily[0][idx].date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      }));
    if (data.sales.length === 1) {
      const r = data.sales[0];
      return {
        labels,
        series: [{ data: r.daily.map((d) => d.total), color: BRIEFING_VENUES[r.venue].accent, width: 2.4 }],
        legend: [{ label: BRIEFING_VENUES[r.venue].name, color: BRIEFING_VENUES[r.venue].accent }],
      };
    }
    const sum = daily[0].map((d, i) => d.total + (daily[1]?.[i]?.total ?? 0));
    return {
      labels,
      series: [
        { data: sum, color: COMBINED, width: 2.6 },
        ...data.sales.map((r) => ({ data: r.daily.map((d) => d.total), color: BRIEFING_VENUES[r.venue].accent, width: 2 })),
      ],
      legend: [
        { label: "Combined", color: COMBINED },
        ...data.sales.map((r) => ({ label: BRIEFING_VENUES[r.venue].name, color: BRIEFING_VENUES[r.venue].accent })),
      ],
    };
  }, [data]);

  const categories = useMemo(() => {
    if (!data) return [];
    const totals = new Map<string, { label: string; value: number }>();
    for (const report of data.sales) {
      for (const slice of report.categories[catPeriod]) {
        const row = totals.get(slice.key) ?? { label: slice.label, value: 0 };
        row.value += slice.value;
        totals.set(slice.key, row);
      }
    }
    const grand = [...totals.values()].reduce((s, r) => s + r.value, 0) || 1;
    return [...totals.entries()]
      .map(([key, r]) => ({ key, label: r.label, value: r.value, disp: gbp(r.value), share: (r.value / grand) * 100 }))
      .sort((a, b) => b.value - a.value);
  }, [data, catPeriod]);

  const dateBig = data
    ? new Date(`${data.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : "";

  if (status === "forbidden") {
    return (
      <div className="mx-auto max-w-[520px] px-6 py-24 text-center">
        <h1 className="font-display text-2xl">Management dashboard</h1>
        <p className="mt-3 text-sm leading-relaxed text-charcoal">
          This is the leadership view — your account doesn&apos;t have access to it. If you think it should, ask Ben to grant
          &ldquo;View dashboard&rdquo; in Settings → Team.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1220px] px-4 pb-20 sm:px-10">
      {/* ===== Masthead ===== */}
      <header className="mb-[26px] border-b-[1.5px] border-rust pb-[22px] pt-[30px] sm:pt-[34px]">
        <div className="mb-[22px] flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs font-semibold uppercase tracking-[.18em] text-rust">Management dashboard</div>
          <div className="flex flex-wrap items-center gap-[18px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-cream-2 bg-white px-[13px] py-1.5 text-[11.5px] font-semibold text-charcoal">
              {icon(ICONS.users, 15)}
              Ben &amp; SLT
            </span>
            {syncedAt && (
              <span className="flex items-center gap-[7px] text-[11.5px] text-stone">
                <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-moss" />
                Synced {syncedAt}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-7">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-3">
              <span
                className="inline-flex rounded-full px-[11px] py-1 text-[11px] font-bold uppercase tracking-[.08em] text-white"
                style={{ background: scope?.accent ?? "#AD3B28" }}
              >
                {scope?.name ?? "Both venues"}
              </span>
              <span className="text-[12.5px] text-stone">{scope?.place ?? "Weir Mill · Bramhall"}</span>
            </div>
            <h1 className="font-display text-[clamp(42px,5.4vw,64px)] leading-[.9] tracking-[-.02em] text-ink">
              {dateBig || " "}
            </h1>
            <p className="mt-[11px] max-w-[520px] text-[13.5px] text-charcoal">
              A leadership snapshot {scope ? `for ${scope.name}` : "across both venues"} — sales, live operations and trends.
            </p>
          </div>
          {hero && (
            <div className="min-w-[232px] rounded-xl border border-cream-2 bg-white px-5 py-[15px] shadow-sm">
              <div className="text-[10px] font-semibold uppercase tracking-[.14em] text-stone">
                {scope ? scope.name : "Combined"} revenue · month to date
              </div>
              <div className="mt-[7px] flex items-baseline gap-3">
                <div className="font-display text-[33px] leading-none text-ink">{gbp(hero.cur)}</div>
                <DeltaPill cur={hero.cur} prev={hero.prev} />
              </div>
              <div className="mt-1.5 text-[11.5px] text-stone">vs last month · Square + Stripe</div>
            </div>
          )}
        </div>
      </header>

      {status === "loading" && (
        <div className="flex flex-col gap-5" aria-busy>
          <div className="h-[110px] animate-pulse rounded-xl bg-cream-2/70" />
          <div className="h-[320px] animate-pulse rounded-xl bg-cream-2/70" />
          <div className="h-[260px] animate-pulse rounded-xl bg-cream-2/50" />
        </div>
      )}
      {status === "error" && (
        <div className="rounded-xl border border-cream-2 bg-white p-8 text-center text-sm text-charcoal">
          The dashboard couldn&apos;t load just now — check your connection and try again.
        </div>
      )}

      {status === "ok" && data && (
        <>
          {/* ===== Quick-look tiles ===== */}
          {data.tiles.length > 0 && (
            <div className="mb-9 flex gap-3 overflow-x-auto pb-1.5">
              {data.tiles.map((t) => {
                const meta = TILE_META[t.key];
                return (
                  <Link
                    key={t.key}
                    href={meta.href}
                    className="group flex min-w-[170px] flex-1 flex-col gap-2.5 rounded-[10px] border border-cream-2 bg-white p-[14px] pb-[13px] text-left shadow-sm transition-colors hover:border-ink"
                    style={{ borderLeft: `3px solid ${meta.accent}` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-[34px] w-[34px] items-center justify-center rounded-lg" style={{ background: meta.tint, color: meta.accent }}>
                        {icon(meta.icon)}
                      </span>
                      <span className="translate-x-[-3px] translate-y-[3px] text-stone opacity-0 transition-all group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100">
                        {icon(ICONS.arrowUR, 16)}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <div className="font-display text-[26px] leading-none text-ink">{t.value}</div>
                        {t.flag && <Chip text={t.flag.text} tone={t.flag.tone} />}
                      </div>
                      <div className="mt-1.5 text-[12.5px] font-semibold leading-[1.25] text-charcoal">{t.label}</div>
                      <div className="mt-0.5 text-[11.5px] text-stone">{t.sub}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* ===== Sales ===== */}
          {data.sales.length > 0 && (
            <section className="mb-10">
              <SectionHead
                eyebrow="Sales"
                title="Revenue across the group"
                aside={
                  data.salesSample ? (
                    <span className="inline-flex items-center gap-2">
                      <Chip text="Sample data" tone="slow" />
                      Square &amp; Stripe not connected yet
                    </span>
                  ) : (
                    "Square (in-store) + Stripe (online) · prior-period change shown"
                  )
                }
              />
              <div className={`grid gap-5 ${single ? "max-w-[600px] grid-cols-1" : "grid-cols-1 items-start lg:grid-cols-2"}`}>
                {data.sales.map((report) => (
                  <SalesCard key={report.venue} report={report} />
                ))}
              </div>

              {!single && (
                <div className="mt-4 grid grid-cols-1 gap-1.5 rounded-[10px] p-2 text-cream shadow-sm sm:grid-cols-3" style={{ background: COMBINED }}>
                  {SALES_PERIODS.map((p) => {
                    const cur = data.sales.reduce((s, r) => s + combined(r.periods[p.key]), 0);
                    const prev = data.sales.reduce((s, r) => s + prevCombined(r.periods[p.key]), 0);
                    return (
                      <div key={p.key} className={`rounded-lg px-4 py-[13px] ${p.key === "month" ? "bg-cream/10" : ""}`}>
                        <div className="text-[10px] uppercase tracking-[.12em] text-cream/60">{p.label}</div>
                        <div className="mt-1 font-display text-[27px] leading-[1.05]">{gbp(cur)}</div>
                        <DeltaPill cur={cur} prev={prev} muted={p.key !== "month"} />
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-[22px] grid grid-cols-1 gap-5 lg:grid-cols-[1.75fr_1fr]">
                <div className="rounded-[10px] border border-cream-2 bg-white px-5 pb-[18px] pt-4 shadow-sm">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-display text-lg">Daily revenue · last 28 days</h3>
                    <div className="flex flex-wrap gap-3.5">
                      {chart?.legend.map((l) => (
                        <span key={l.label} className="inline-flex items-center gap-1.5 text-[11.5px] text-charcoal">
                          <span className="h-[3px] w-4 rounded-sm" style={{ background: l.color }} />
                          {l.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-1.5">{chart && <LineChart series={chart.series} labels={chart.labels} />}</div>
                </div>
                <div className="rounded-[10px] border border-cream-2 bg-white px-5 pb-[18px] pt-4 shadow-sm">
                  <div className="mb-1 flex items-start justify-between gap-2.5">
                    <h3 className="font-display text-lg">Top Square categories</h3>
                    <div className="inline-flex rounded-full border border-cream-2 bg-cream p-0.5">
                      {SALES_PERIODS.map((p) => (
                        <button
                          key={p.key}
                          onClick={() => pickCatPeriod(p.key)}
                          className={`whitespace-nowrap rounded-full px-[11px] py-[5px] text-[11px] font-semibold transition-colors ${
                            catPeriod === p.key ? "bg-ink text-cream" : "text-stone hover:text-ink"
                          }`}
                        >
                          {p.label.replace(" to date", "")}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-4 text-[11.5px] text-stone">
                    In-store takings by category · {scope ? scope.name : "both venues"}
                  </div>
                  <Bars items={categories} color={categories.map((c) => CAT_COLORS[c.key] ?? "#AD3B28")} />
                </div>
              </div>
            </section>
          )}

          {/* ===== Operational ===== */}
          {data.ops.length > 0 && (
            <section className="mb-10">
              <SectionHead
                eyebrow="Operational"
                title="What needs action now"
                aside="Live from Orders, Ordering Hub, Book Clubs, Returns & Deputy"
              />
              <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
                {data.ops.map((card) => (
                  <OpsCard key={card.key} card={card} />
                ))}
              </div>
            </section>
          )}

          {/* ===== Trend ===== */}
          {data.trends.length > 0 && (
            <section>
              <SectionHead eyebrow="Trend" title="How the business is moving" aside="Weekly / monthly · for SLT review" />
              <div className="grid grid-cols-1 items-start gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
                {data.trends.map((card) => (
                  <TrendCard key={card.key} card={card} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
