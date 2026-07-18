"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VenueKey } from "@/lib/config";
import type { BriefingDay, BriefingEvent, UrgentAlert, VenueBriefing } from "@/lib/briefing";
import {
  ALERT_THEME,
  BRIEFING_COLUMNS,
  BRIEFING_VENUES,
  addDays,
  dateParts,
  nowMinLondon,
  relLabel,
  todayLondon,
} from "@/lib/briefing";
import { useVenue } from "@/components/VenueContext";
import {
  BrandHeader,
  ChatterCard,
  EventsList,
  OnShift,
  Skeleton,
  StatsRow,
  TasksCard,
  ic,
} from "@/components/briefing/cells";
import { WrapCard } from "@/components/briefing/cells";

// Daily Briefing — the app's landing page. Layout, palette and interaction
// come from the Claude Design file "Daily Briefing.dc.html" (the design is
// authoritative where it goes beyond the spec). The date hero renders
// immediately; each data section fills in as its fetch lands (spec §1).

type View = "overview" | "full";

interface Weather {
  ok: boolean;
  hi?: string;
  lo?: string;
  rain?: string;
  desc?: string;
  icon?: string;
}

const WEATHER_ICONS: Record<string, string> = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5"/>',
  cloud: '<path d="M6 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17.5 18z"/>',
  rain: '<path d="M6 14a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17.5 14z"/><path d="M8 17l-1 2M13 17l-1 2M17 17l-1 2"/>',
  snow: '<path d="M6 14a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17.5 14z"/><path d="M8 18h.01M12 20h.01M16 18h.01"/>',
  storm: '<path d="M6 14a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17.5 14z"/><path d="M13 14l-3 5h4l-3 5"/>',
  fog: '<path d="M4 10h16M6 14h13M8 18h9"/>',
};

const ICON_ALERT = '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v0"/>';
const ICON_CLOSE = '<path d="M6 6l12 12M18 6L6 18"/>';
const ICON_CHAT = '<path d="M4 5h16v11H9l-4 4v-4H4z"/>';
const ICON_CAKE =
  '<path d="M4 20h16v-6H4zM6 14V9m6 5V9m6 5V9M8 6a1.5 1.5 0 1 0-3 0c0 1 1.5 2 1.5 2S8 7 8 6zM19 6a1.5 1.5 0 1 0-3 0c0 1 1.5 2 1.5 2S19 7 19 6zM13.5 5a1.5 1.5 0 1 0-3 0c0 1 1.5 2 1.5 2s1.5-1 1.5-2z"/>';
const ICON_RETURN = '<path d="M9 14l-4-4 4-4"/><path d="M5 10h9a5 5 0 0 1 0 10h-1"/>';

const seg = (active: boolean) =>
  `inline-flex items-center gap-[7px] whitespace-nowrap rounded-full px-[15px] py-2 text-[13px] font-semibold transition-colors ${
    active ? "bg-ink text-cream" : "text-stone hover:text-ink"
  }`;

export default function BriefingPage() {
  const { venue, setVenue } = useVenue();
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<{ day: BriefingDay; events: Record<VenueKey, BriefingEvent[]> } | null>(null);
  const [error, setError] = useState("");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [nowMin, setNowMin] = useState(() => nowMinLondon());
  const [slackSeen, setSlackSeen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftLoc, setDraftLoc] = useState<UrgentAlert["loc"]>("both");

  const today = todayLondon();
  const date = addDays(today, offset);
  const parts = dateParts(date);
  const isToday = offset === 0;

  // Persisted Detail toggle (the Location toggle persists via VenueContext).
  useEffect(() => {
    const saved = localStorage.getItem("db-view");
    if (saved === "full" || saved === "overview") setView(saved);
  }, []);
  const pickView = (v: View) => {
    setView(v);
    localStorage.setItem("db-view", v);
  };

  useEffect(() => {
    const t = setInterval(() => setNowMin(nowMinLondon()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let stale = false;
    setData(null);
    setError("");
    fetch(`/api/briefing?date=${date}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => !stale && setData(d))
      .catch((e) => !stale && setError(e.message));
    return () => {
      stale = true;
    };
  }, [date]);

  useEffect(() => {
    let stale = false;
    setWeather(null);
    fetch(`/api/briefing/weather?date=${date}`)
      .then((r) => (r.ok ? r.json() : { ok: false }))
      .then((w) => !stale && setWeather(w))
      .catch(() => !stale && setWeather({ ok: false }));
    return () => {
      stale = true;
    };
  }, [date]);

  // ----- mutations (all optimistic — behind-the-till phones are slow) -----

  const toggleTask = useCallback(
    (venueKey: VenueKey, id: string, done: boolean) => {
      setData((d) => {
        if (!d) return d;
        const v: VenueBriefing = {
          ...d.day.venues[venueKey],
          tasks: d.day.venues[venueKey].tasks.map((t) => (t.id === id ? { ...t, done } : t)),
        };
        return { ...d, day: { ...d.day, venues: { ...d.day.venues, [venueKey]: v } } };
      });
      fetch("/api/briefing/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, id, done }),
      }).catch(() => {});
    },
    [date]
  );

  const postAlert = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setAdding(false);
    const res = await fetch("/api/briefing/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, text, loc: draftLoc }),
    });
    if (res.ok) {
      const { alert } = await res.json();
      setData((d) => d && { ...d, day: { ...d.day, alerts: [...d.day.alerts, alert] } });
    }
  };

  const dismissAlert = (id: string) => {
    setData((d) => d && { ...d, day: { ...d.day, alerts: d.day.alerts.filter((a) => a.id !== id) } });
    fetch(`/api/briefing/alerts?date=${date}&id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  };

  const saveWrap = useCallback(
    async (venueKey: VenueKey, headline: string, body: string) => {
      const res = await fetch("/api/briefing/wrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, venue: venueKey, headline, body }),
      });
      if (!res.ok) throw new Error(`Save failed (HTTP ${res.status})`);
    },
    [date]
  );

  // ----- derived -----

  const keys: VenueKey[] =
    venue === "all" ? BRIEFING_COLUMNS : ([venue] as VenueKey[]);
  const single = keys.length === 1;
  const isFull = view === "full";

  const visibleAlerts = (data?.day.alerts ?? []).filter(
    (a) => venue === "all" || a.loc === "both" || a.loc === venue
  );
  const milestones = (data?.day.milestones ?? []).filter((m) => keys.includes(m.venue));
  const newSlack = keys
    .map((k) => ({
      k,
      n: (data?.day.venues[k].slack ?? []).filter((m) => m.isNew).length,
    }))
    .filter((x) => x.n > 0);
  const totalNew = newSlack.reduce((a, x) => a + x.n, 0);

  const steps = useMemo(
    () =>
      [offset - 1, offset, offset + 1].map((o) => {
        const p = dateParts(addDays(today, o));
        return { o, wd: p.wdShort, day: p.day };
      }),
    [offset, today]
  );

  // Row indexes for the lg grid (mobile stacks column-major in DOM order).
  const rows = { header: 1, wrap: 2, stats: 3, shift: 4, events: 5, tasks: 6, chatter: 7 };

  return (
    <div
      className="ob-screen min-h-screen"
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg, transparent, transparent calc(12.5% - 1px), rgba(20,17,13,.028) calc(12.5% - 1px), rgba(20,17,13,.028) 12.5%)",
      }}
    >
      <div className="mx-auto max-w-[1180px] px-4 pb-[72px] sm:px-10">
        {/* ============ masthead ============ */}
        <header className="mb-[22px] border-b-[1.5px] border-rust pb-6 pt-6 sm:pt-9">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="eyebrow text-stone">Daily briefing</div>
            <div className="flex flex-wrap items-center gap-5">
              {weather?.ok && (
                <div className="flex items-center gap-[11px] rounded-full border border-cream-2 bg-white py-[7px] pl-[11px] pr-[15px]">
                  <span className="flex text-rust">{ic(WEATHER_ICONS[weather.icon ?? "cloud"], 22)}</span>
                  <div className="leading-tight">
                    <div className="text-[13.5px] font-semibold text-ink">
                      {weather.hi} <span className="font-normal text-stone">/ {weather.lo}</span>
                    </div>
                    <div className="text-[11px] text-stone">
                      {weather.desc} · {weather.rain} rain
                    </div>
                  </div>
                  <span className="ml-0.5 border-l border-cream-2 pl-[11px] text-[10px] uppercase tracking-[.1em] text-stone">
                    Stockport
                  </span>
                </div>
              )}
              <div className="flex items-center gap-[7px] text-[11.5px] text-stone">
                <span
                  className="h-[7px] w-[7px] rounded-full bg-[#5F8A57]"
                  style={{ animation: "db-pulse 1.8s ease-in-out infinite" }}
                />
                {data?.day.rosterAsOf ? `Synced ${data.day.rosterAsOf}` : "Live"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="mb-1.5 flex items-center gap-3">
                <span
                  className={`inline-flex rounded-full px-[11px] py-1 text-[11px] font-bold uppercase tracking-[.1em] ${
                    isToday ? "bg-rust text-white" : "bg-[#F5E4C3] text-[#8A5A12]"
                  }`}
                >
                  {relLabel(offset)}
                </span>
                {!isToday && (
                  <button
                    onClick={() => setOffset(0)}
                    className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-rust underline underline-offset-[3px]"
                  >
                    {ic(ICON_RETURN, 14)}
                    Back to today
                  </button>
                )}
              </div>
              <h1 className="mb-4 font-display leading-[.94] tracking-[-.02em] text-ink" style={{ fontSize: "clamp(42px, 5.4vw, 68px)" }}>
                {parts.weekday} <span className="text-charcoal">{parts.dm}</span>
              </h1>
              <div className="inline-flex items-center gap-1 rounded-full border border-cream-2 bg-white p-1">
                <button
                  onClick={() => setOffset(offset - 1)}
                  aria-label="Previous day"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal hover:bg-cream-2/60"
                >
                  {ic('<path d="M15 18l-6-6 6-6"/>', 18)}
                </button>
                {steps.map((s) => (
                  <button
                    key={s.o}
                    onClick={() => setOffset(s.o)}
                    className={`min-w-[44px] rounded-full px-2.5 py-1 text-center ${
                      s.o === offset ? "bg-rust text-white" : "text-charcoal hover:bg-cream-2/60"
                    }`}
                  >
                    <span className="block text-[9px] uppercase leading-none tracking-[.1em] opacity-70">{s.wd}</span>
                    <span className="block text-sm font-semibold leading-[1.25] tabular-nums">{s.day}</span>
                  </button>
                ))}
                <button
                  onClick={() => setOffset(offset + 1)}
                  aria-label="Next day"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal hover:bg-cream-2/60"
                >
                  {ic('<path d="M9 18l6-6-6-6"/>', 18)}
                </button>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3.5 sm:items-end">
              <div className="flex flex-col items-start gap-[7px] sm:items-end">
                <div className="eyebrow text-stone">Location</div>
                <div className="inline-flex rounded-full border border-cream-2 bg-white p-[3px]">
                  {(
                    [
                      { key: "all", label: "Both", dot: "" },
                      { key: "prologue", label: "Prologue", dot: BRIEFING_VENUES.prologue.accent },
                      { key: "simply", label: "Simply Books", dot: BRIEFING_VENUES.simply.accent },
                    ] as const
                  ).map((o) => (
                    <button key={o.key} onClick={() => setVenue(o.key)} className={seg(venue === o.key)}>
                      {o.dot && venue !== o.key && (
                        <span className="h-2 w-2 rounded-full" style={{ background: o.dot }} />
                      )}
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-start gap-[7px] sm:items-end">
                <div className="eyebrow text-stone">Detail</div>
                <div className="inline-flex rounded-full border border-cream-2 bg-white p-[3px]">
                  {(["overview", "full"] as View[]).map((v) => (
                    <button key={v} onClick={() => pickView(v)} className={seg(view === v)}>
                      {v === "overview" ? "Overview" : "Full day"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-3.5 rounded-[10px] border border-coral bg-white px-4 py-3 text-[13px] text-coral">
            Couldn&apos;t load the briefing ({error}) — pull to refresh or try again shortly.
          </div>
        )}

        {/* ============ urgent alerts ============ */}
        <div className="mb-3.5 flex justify-end">
          <button
            onClick={() => setAdding((a) => !a)}
            className="inline-flex items-center gap-[7px] rounded-full border-[1.5px] border-[#C99A3E] bg-white px-[15px] py-2 text-[12.5px] font-semibold text-[#8A5A12] hover:border-[#8A5A12]"
          >
            {ic(ICON_ALERT, 16)}
            Post urgent alert
          </button>
        </div>
        {adding && (
          <div className="mb-3.5 rounded-[10px] border-[1.5px] border-[#E7D3A9] bg-[#FBF3E6] px-4 py-3.5">
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[.14em] text-[#8A5A12]">
              New urgent alert
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && postAlert()}
                placeholder="Type an urgent note for the team…"
                className="min-w-[220px] flex-1 rounded-lg border border-[#E7D3A9] bg-white px-3 py-2.5 text-[13.5px] text-ink"
              />
              <div className="inline-flex rounded-lg border border-[#E7D3A9] bg-white p-[3px]">
                {(
                  [
                    { key: "both", label: "Both" },
                    { key: "prologue", label: "Prologue" },
                    { key: "simply", label: "Simply Books" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setDraftLoc(o.key)}
                    className={`whitespace-nowrap rounded-md px-[11px] py-[7px] text-xs font-semibold ${
                      draftLoc === o.key ? "bg-[#B0812F] text-white" : "text-stone"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <button
                onClick={postAlert}
                className="rounded-lg border-[1.5px] border-[#B0812F] bg-[#B0812F] px-4 py-2.5 text-[13px] font-semibold text-white"
              >
                Post
              </button>
              <button
                onClick={() => setAdding(false)}
                className="rounded-lg border border-cream-2 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-charcoal"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {visibleAlerts.length > 0 && (
          <div className="mb-3.5 rounded-[10px] border-[1.5px] border-[#E7D3A9] bg-[#FBF3E6] px-4 py-3.5">
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="flex text-[#B0812F]">{ic(ICON_ALERT, 16)}</span>
              <span className="text-[11px] font-bold uppercase tracking-[.14em] text-[#8A5A12]">
                Urgent — read before shift
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {visibleAlerts.map((a) => {
                const th = ALERT_THEME[a.loc];
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-[11px] rounded-lg border border-cream-2 bg-white px-3 py-[11px]"
                    style={{ borderLeft: `4px solid ${th.c}` }}
                  >
                    <span className="mt-[5px] h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: th.c }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold leading-[1.35] text-ink">{a.text}</div>
                      <span
                        className="mt-1.5 inline-flex items-center rounded-full px-[9px] py-0.5 text-[10px] font-bold uppercase tracking-[.06em]"
                        style={{ color: th.c, background: th.t }}
                      >
                        {a.loc === "both" ? "Both venues" : BRIEFING_VENUES[a.loc].name}
                      </span>
                    </div>
                    <button
                      onClick={() => dismissAlert(a.id)}
                      aria-label="Dismiss alert"
                      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md text-stone hover:bg-ink/5 hover:text-ink"
                    >
                      {ic(ICON_CLOSE, 16)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============ slack notification ============ */}
        {!slackSeen && totalNew > 0 && (
          <div className="mb-3.5 flex items-center gap-3 rounded-[10px] border border-cream-2 bg-white px-4 py-3 shadow-sm">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-shell text-rust">
              {ic(ICON_CHAT, 18)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold text-ink">
                {totalNew} new on-shift {totalNew === 1 ? "message" : "messages"}
              </div>
              <div className="mt-px text-xs text-stone">
                Since you last checked — jump to the on-shift chatter below.
              </div>
            </div>
            <div className="hidden flex-wrap gap-2 sm:flex">
              {newSlack.map((x) => (
                <span
                  key={x.k}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cream-2 bg-cream px-[11px] py-[5px] text-[11.5px] font-semibold text-charcoal"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: BRIEFING_VENUES[x.k].accent, animation: "db-pulse 1.8s ease-in-out infinite" }}
                  />
                  {BRIEFING_VENUES[x.k].channel} · {x.n}
                </span>
              ))}
            </div>
            <button
              onClick={() => setSlackSeen(true)}
              aria-label="Dismiss"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-stone hover:bg-ink/5 hover:text-ink"
            >
              {ic(ICON_CLOSE, 16)}
            </button>
          </div>
        )}

        {/* ============ celebrations ============ */}
        {isToday && milestones.length > 0 && (
          <div className="mb-[22px] flex flex-wrap items-center gap-3.5 rounded-[10px] border border-[#F1CFCB] bg-shell px-[18px] py-3">
            <span className="flex shrink-0 text-rust">{ic(ICON_CAKE, 18)}</span>
            <span className="text-[11px] font-bold uppercase tracking-[.14em] text-rust">Celebrating today</span>
            <div className="flex flex-1 flex-wrap gap-2.5">
              {milestones.map((m) => (
                <span
                  key={`${m.venue}-${m.who}`}
                  className="inline-flex items-center gap-2 rounded-full border border-[#F1CFCB] bg-white py-[5px] pl-[11px] pr-[13px] text-[13.5px] text-charcoal"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: BRIEFING_VENUES[m.venue].accent }} />
                  <span className="font-semibold">{m.who}</span> {m.what}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ============ venue columns ============ */}
        <div
          className={`flex flex-col gap-[26px] lg:grid lg:items-start lg:gap-x-[34px] lg:gap-y-[26px] ${
            single ? "lg:mx-auto lg:max-w-[600px] lg:grid-cols-1" : "lg:grid-cols-2"
          }`}
        >
          {keys.map((k, colIdx) => {
            const theme = BRIEFING_VENUES[k];
            const col = single ? 1 : colIdx + 1;
            const v = data?.day.venues[k];
            const events = data?.events[k];
            return (
              <div key={k} className="contents">
                {v ? (
                  <BrandHeader pos={{ col, row: rows.header }} theme={theme} data={v} nowMin={nowMin} isToday={isToday} />
                ) : (
                  <Skeleton pos={{ col, row: rows.header }} h={66} />
                )}
                {isFull &&
                  (v ? (
                    <WrapCard
                      pos={{ col, row: rows.wrap }}
                      theme={theme}
                      wrap={v.wrap}
                      yesterdayLabel={dateParts(addDays(date, -1)).dmShort}
                      onSave={(h, b) => saveWrap(k, h, b)}
                    />
                  ) : (
                    <Skeleton pos={{ col, row: rows.wrap }} h={120} />
                  ))}
                {isFull &&
                  (v ? (
                    <StatsRow pos={{ col, row: rows.stats }} theme={theme} data={v} />
                  ) : (
                    <Skeleton pos={{ col, row: rows.stats }} h={70} />
                  ))}
                {v ? (
                  <OnShift
                    pos={{ col, row: rows.shift }}
                    theme={theme}
                    data={v}
                    nowMin={nowMin}
                    isToday={isToday}
                    asOf={data?.day.rosterAsOf ?? null}
                  />
                ) : (
                  <Skeleton pos={{ col, row: rows.shift }} h={280} />
                )}
                {events ? (
                  <EventsList pos={{ col, row: rows.events }} theme={theme} events={events} />
                ) : (
                  <Skeleton pos={{ col, row: rows.events }} h={180} />
                )}
                {v ? (
                  <TasksCard
                    pos={{ col, row: rows.tasks }}
                    theme={theme}
                    data={v}
                    onToggle={(id, done) => toggleTask(k, id, done)}
                  />
                ) : (
                  <Skeleton pos={{ col, row: rows.tasks }} h={180} />
                )}
                {isFull &&
                  (v ? (
                    <ChatterCard pos={{ col, row: rows.chatter }} theme={theme} data={v} />
                  ) : (
                    <Skeleton pos={{ col, row: rows.chatter }} h={160} />
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
