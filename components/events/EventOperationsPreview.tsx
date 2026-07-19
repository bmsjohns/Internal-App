"use client";

import { useState } from "react";
import type {
  EventOperationsPreview,
  EventStockPreview,
  EventTaskPreview,
  EventTaskStatus,
  LumaPreview,
} from "@/lib/event-operations";
import { readinessSummary } from "@/lib/event-operations";
import { panelCls, panelHead } from "@/components/form";

const rust = "#AD3B28";
const gold = "#B0812F";
const green = "#5F7355";

const icon = (path: string, size = 16) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: path }} />
);

const ICON_SPARK = '<path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/>';
const ICON_SYNC = '<path d="M20 7h-5V2"/><path d="M20 7a8 8 0 1 0 1 8"/>';
const ICON_TICKET = '<path d="M3 9a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 0 0-4V5H3z"/><path d="M13 5v12"/>';
const ICON_BOX = '<path d="M21 8l-9 5-9-5"/><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M12 13v8"/>';

export function PreviewModeNotice() {
  return (
    <div className="flex flex-col items-start justify-between gap-2.5 rounded-[10px] border border-[#C8A96B66] bg-[#F7EEDC] px-4 py-3 text-[#765823] sm:flex-row sm:items-center sm:py-2.5">
      <div className="flex items-start gap-2.5 sm:items-center">
        <span className="mt-0.5 shrink-0 sm:mt-0">{icon(ICON_SPARK, 14)}</span>
        <div className="flex flex-col gap-0.5 text-[12px] sm:flex-row sm:items-center sm:gap-2">
          <span className="font-semibold">Luma preview mode</span>
          <span className="font-normal opacity-80">Mock data only · interactions reset on refresh · nothing is written</span>
        </div>
      </div>
      <span className="rounded-full border border-[#B0812F44] bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">Safe preview</span>
    </div>
  );
}

export function EventReadinessStrip({ operations }: { operations: EventOperationsPreview }) {
  const ready = readinessSummary(operations.tasks);
  const luma = operations.luma;
  const stock = operations.stock[0];
  const soldPercent = luma.capacity ? Math.round((luma.approved / luma.capacity) * 100) : 0;

  return (
    <div className="grid overflow-hidden rounded-[12px] border border-cream-2 bg-white shadow-[0_5px_22px_rgba(44,37,32,0.035)] sm:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1fr_1fr]">
      <div className="flex items-center gap-3.5 border-b border-cream-2 px-4 py-3.5 sm:border-r xl:border-b-0">
        <ProgressRing value={ready.percent} />
        <div className="min-w-0">
          <div className="eyebrow mb-1 text-stone">Readiness</div>
          <div className="font-display text-[18px] leading-none">{ready.done} of {ready.total} complete</div>
          <div className={`mt-1 text-[11.5px] ${ready.overdue ? "font-semibold text-rust" : "text-stone"}`}>
            {ready.overdue ? `${ready.overdue} overdue action${ready.overdue === 1 ? "" : "s"}` : "Everything on track"}
          </div>
        </div>
      </div>
      <SummaryCell
        label="Operational stage"
        value={operations.stage}
        detail={operations.stage === "Ready" ? "Ready for doors" : operations.stage === "Preparing" ? "Work in progress" : "Current event phase"}
        dot={operations.stage === "Ready" || operations.stage === "Complete" ? green : operations.stage === "Live" ? rust : gold}
      />
      <SummaryCell
        label="Luma tickets"
        value={luma.connected ? `${luma.approved} / ${luma.capacity}` : "Not linked"}
        detail={luma.connected ? `${soldPercent}% booked${luma.waitlist ? ` · ${luma.waitlist} waitlisted` : ""}` : "Link an event to begin sync"}
        dot={luma.status === "sold_out" ? rust : luma.connected ? green : "#B8B0A6"}
      />
      <SummaryCell
        label="Event stock"
        value={stock ? stock.status : "No lead title"}
        detail={stock ? `${stock.received} received · ${stock.reserved} reserved` : "Add a title to plan stock"}
        dot={!stock ? "#B8B0A6" : stock.status === "Ready" || stock.status === "Reconciled" ? green : gold}
        last
      />
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  return (
    <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${value === 100 ? green : rust} ${value * 3.6}deg, var(--color-cream-2) 0deg)` }}>
      <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white text-[12px] font-bold tabular-nums text-charcoal">{value}%</div>
    </div>
  );
}

function SummaryCell({ label, value, detail, dot, last = false }: { label: string; value: string; detail: string; dot: string; last?: boolean }) {
  return (
    <div className={`flex min-h-[82px] items-center gap-3 border-b border-cream-2 px-4 py-3.5 xl:border-b-0 xl:border-r ${last ? "xl:border-r-0" : ""}`}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot, boxShadow: `0 0 0 4px ${dot}18` }} />
      <div className="min-w-0">
        <div className="eyebrow mb-1 text-stone">{label}</div>
        <div className="truncate text-[14px] font-semibold text-ink">{value}</div>
        <div className="mt-0.5 truncate text-[11.5px] text-stone">{detail}</div>
      </div>
    </div>
  );
}

export function EventTasksTab({ tasks, onChange }: { tasks: EventTaskPreview[]; onChange: (tasks: EventTaskPreview[]) => void }) {
  const [filter, setFilter] = useState<"all" | EventTaskStatus>("all");
  const ready = readinessSummary(tasks);
  const filtered = filter === "all" ? tasks : tasks.filter((task) => task.status === filter);
  const counts = { todo: tasks.filter((task) => task.status === "todo").length, doing: tasks.filter((task) => task.status === "doing").length, done: ready.done };
  const cycle = (task: EventTaskPreview) => {
    const next: EventTaskStatus = task.status === "todo" ? "doing" : task.status === "doing" ? "done" : "todo";
    onChange(tasks.map((row) => row.id === task.id ? { ...row, status: next } : row));
  };

  return (
    <div className="flex max-w-[1060px] flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniMetric label="Completed" value={`${ready.done}/${ready.total}`} detail={`${ready.percent}% ready`} tone="green" />
        <MiniMetric label="In progress" value={String(counts.doing)} detail="Being worked on" tone="gold" />
        <MiniMetric label="Needs attention" value={String(ready.overdue)} detail={ready.overdue ? "Past due date" : "Nothing overdue"} tone={ready.overdue ? "rust" : "stone"} />
      </div>

      <div className="overflow-hidden rounded-[11px] border border-cream-2 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-2 px-4 py-3.5 sm:px-5">
          <div>
            <div className="font-display text-[18px]">Event readiness</div>
            <div className="mt-0.5 text-xs text-stone">Click a status control to preview the workflow. Changes stay in this browser only.</div>
          </div>
          <div className="flex rounded-lg bg-cream p-1">
            {(["all", "todo", "doing", "done"] as const).map((key) => (
              <button key={key} onClick={() => setFilter(key)} className={`cursor-pointer rounded-md px-3 py-1.5 text-[11.5px] font-semibold capitalize ${filter === key ? "bg-white text-rust shadow-sm" : "text-stone"}`}>
                {key === "all" ? "All" : key === "todo" ? "To do" : key === "doing" ? "In progress" : "Done"}
              </button>
            ))}
          </div>
        </div>
        <div>
          {filtered.map((task) => {
            const overdue = task.status !== "done" && task.dueDate < new Date().toISOString().slice(0, 10);
            return (
              <div key={task.id} className="group grid gap-3 border-b border-cream-2 px-4 py-3.5 last:border-0 hover:bg-shell/40 sm:grid-cols-[auto_minmax(220px,1fr)_140px_110px] sm:items-center sm:px-5">
                <button onClick={() => cycle(task)} aria-label={`Change status for ${task.title}`} className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border transition-colors ${task.status === "done" ? "border-[#5F735544] bg-[#5F735518] text-[#5F7355]" : task.status === "doing" ? "border-[#B0812F55] bg-[#B0812F16] text-[#8a6420]" : "border-cream-2 bg-white text-stone"}`}>
                  {task.status === "done" ? icon('<path d="M7 12.5l3 3 7-7"/>', 14) : task.status === "doing" ? <span className="h-2 w-2 rounded-full bg-current" /> : <span className="h-2 w-2 rounded-full border border-current" />}
                </button>
                <div className="min-w-0">
                  <div className={`text-[13.5px] font-semibold ${task.status === "done" ? "text-stone line-through" : "text-charcoal"}`}>{task.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:hidden">
                    <CategoryPill category={task.category} />
                    <span className="text-[11px] text-stone">{task.owner}</span>
                  </div>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-shell font-display text-[10px] text-rust">{initials(task.owner)}</span>
                  <span className="truncate text-[12px] text-charcoal">{task.owner.split(" ")[0]}</span>
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <CategoryPill category={task.category} compact />
                  <span className={`whitespace-nowrap text-[11.5px] ${overdue ? "font-bold text-rust" : "text-stone"}`}>{formatShortDate(task.dueDate)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function EventTicketsTab({ initial }: { initial: LumaPreview }) {
  const [luma, setLuma] = useState(initial);
  const [syncing, setSyncing] = useState(false);
  const issued = luma.ticketTypes.reduce((sum, ticket) => sum + ticket.issued, 0);
  const available = Math.max(0, luma.capacity - issued);
  const sellThrough = luma.capacity ? Math.round((issued / luma.capacity) * 100) : 0;

  const sync = () => {
    setSyncing(true);
    window.setTimeout(() => {
      setLuma((current) => ({ ...current, lastSyncedAt: new Date().toISOString() }));
      setSyncing(false);
    }, 650);
  };

  if (!luma.connected) {
    return (
      <div className="max-w-[760px] rounded-[14px] border border-dashed border-cream-2 bg-white px-6 py-12 text-center sm:px-12">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-shell text-rust">{icon(ICON_TICKET, 24)}</div>
        <h2 className="mb-2 font-display text-2xl">Connect this event to Luma</h2>
        <p className="mx-auto mb-5 max-w-[470px] text-[13.5px] leading-relaxed text-stone">Link an existing Luma event to bring registrations, ticket types, waitlist and check-in activity into Backstage automatically.</p>
        <button className="cursor-not-allowed rounded-md bg-rust px-5 py-2.5 text-[13px] font-semibold text-cream opacity-85" title="Disabled in safe preview mode">Search Luma events</button>
        <div className="mt-3 text-[11.5px] text-stone">Connection actions are disabled on this preview branch.</div>
      </div>
    );
  }

  return (
    <div className="flex max-w-[1080px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[11px] border border-[#5F735533] bg-[#5F73550D] px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5F735518] text-[#5F7355]">{icon('<path d="M8 12.5l2.5 2.5L16 9"/><circle cx="12" cy="12" r="9"/>', 18)}</span>
          <div>
            <div className="text-[13px] font-semibold text-charcoal">Connected to Luma · {luma.eventId}</div>
            <div className="mt-0.5 text-[11.5px] text-stone">Mock webhook feed · synced {relativeTime(luma.lastSyncedAt)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={luma.eventUrl} target="_blank" rel="noreferrer" className="rounded-md border border-cream-2 bg-white px-3 py-2 text-[11.5px] font-semibold text-rust">Open Luma ↗</a>
          <button onClick={sync} disabled={syncing} className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-cream-2 bg-white px-3 py-2 text-[11.5px] font-semibold text-charcoal disabled:opacity-60">
            <span className={syncing ? "animate-spin" : ""}>{icon(ICON_SYNC, 13)}</span>{syncing ? "Syncing…" : "Preview sync"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Registered" value={luma.approved} detail={`${sellThrough}% of capacity`} accent={rust} />
        <MetricCard label="Available" value={available} detail={`${luma.capacity} total capacity`} accent={green} />
        <MetricCard label="Waitlist" value={luma.waitlist} detail={luma.pending ? `${luma.pending} pending approval` : "No pending approvals"} accent={gold} />
        <MetricCard label="Checked in" value={luma.checkedIn} detail={luma.approved ? `${Math.round((luma.checkedIn / luma.approved) * 100)}% of registered` : "Event not started"} accent="#3D6670" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,.75fr)]">
        <section className="overflow-hidden rounded-[11px] border border-cream-2 bg-white">
          <div className="flex items-center justify-between border-b border-cream-2 px-5 py-4">
            <div>
              <div className="font-display text-[18px]">Ticket mix</div>
              <div className="mt-0.5 text-xs text-stone">Live registration totals from the mock Luma feed</div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${luma.status === "sold_out" ? "bg-shell text-rust" : "bg-[#5F735514] text-[#5F7355]"}`}>{luma.status.replace("_", " ")}</span>
          </div>
          <div className="px-5 py-4">
            <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-cream-2">
              {luma.ticketTypes.map((ticket) => <span key={ticket.id} style={{ width: `${luma.capacity ? (ticket.issued / luma.capacity) * 100 : 0}%`, background: ticket.color }} />)}
            </div>
            <div className="flex flex-col">
              {luma.ticketTypes.map((ticket) => (
                <div key={ticket.id} className="grid grid-cols-[minmax(0,1fr)_70px_90px] items-center border-b border-cream-2 py-3 last:border-0">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: ticket.color }} />
                    <div>
                      <div className="text-[13.5px] font-semibold">{ticket.name}</div>
                      <div className="text-[11.5px] text-stone">{ticket.price ? `£${ticket.price.toFixed(2)}` : "Complimentary"}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg tabular-nums">{ticket.issued}</div>
                    <div className="text-[10px] uppercase tracking-wide text-stone">issued</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-semibold tabular-nums">{ticket.checkedIn}</div>
                    <div className="text-[10px] uppercase tracking-wide text-stone">checked in</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={panelCls}>
          <span className={panelHead}>Registration health</span>
          <HealthRow label="Approved" value={luma.approved} color={green} />
          <HealthRow label="Pending" value={luma.pending} color={gold} />
          <HealthRow label="Waitlisted" value={luma.waitlist} color={rust} />
          <HealthRow label="Declined" value={luma.declined} color="#8C857C" />
          <div className="mt-4 rounded-lg bg-cream px-3.5 py-3 text-[11.5px] leading-relaxed text-stone">Guest names are not persisted in this preview. The production integration can fetch current details from Luma only when check-in requires them.</div>
        </section>
      </div>
    </div>
  );
}

export function EventStockTab({ stock, luma }: { stock: EventStockPreview[]; luma: LumaPreview }) {
  if (stock.length === 0) {
    return <EmptyPanel icon={ICON_BOX} title="No event stock planned" body="Add a lead title and ISBN to create an event stock plan and compare copies against Luma demand." />;
  }
  const totalReserved = stock.reduce((sum, row) => sum + row.reserved, 0);
  const totalReceived = stock.reduce((sum, row) => sum + row.received, 0);
  const coverage = totalReserved ? Math.round((totalReceived / totalReserved) * 100) : 100;
  return (
    <div className="flex max-w-[1060px] flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniMetric label="Ticket-linked demand" value={String(totalReserved)} detail="Book + ticket reservations" tone="rust" />
        <MiniMetric label="Copies received" value={String(totalReceived)} detail={`${stock.reduce((sum, row) => sum + row.ordered, 0)} ordered`} tone="green" />
        <MiniMetric label="Demand coverage" value={`${coverage}%`} detail={coverage >= 100 ? "Ticket commitments covered" : `${totalReserved - totalReceived} copies at risk`} tone={coverage >= 100 ? "green" : "gold"} />
      </div>
      <div className="overflow-hidden rounded-[11px] border border-cream-2 bg-white">
        <div className="flex items-center justify-between border-b border-cream-2 px-5 py-4">
          <div><div className="font-display text-[18px]">Event stock order</div><div className="mt-0.5 text-xs text-stone">Preview link to the Ordering Hub · no order has been created</div></div>
          <button disabled className="rounded-md bg-rust px-3.5 py-2 text-[11.5px] font-semibold text-cream opacity-75">Open in Ordering Hub</button>
        </div>
        {stock.map((row) => (
          <div key={row.id} className="px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="font-display text-[20px]">{row.title}</div><div className="mt-1 text-xs text-stone">{row.isbn || "ISBN not set"} · {row.supplier}</div></div>
              <span className="rounded-full bg-[#5F735514] px-3 py-1.5 text-[11px] font-bold text-[#5F7355]">{row.status}</span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {[['Minimum', row.minimum], ['Ordered', row.ordered], ['Received', row.received], ['Reserved', row.reserved], ['Sold', row.sold], ['Returns', row.returned]].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-cream px-3 py-3 text-center"><div className="font-display text-xl tabular-nums">{value}</div><div className="mt-0.5 text-[10px] uppercase tracking-[.09em] text-stone">{label}</div></div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-cream-2 pt-3 text-[11.5px] text-stone"><span>Expected {formatLongDate(row.expectedDate)}</span><span>Luma demand: {luma.ticketTypes.find((ticket) => ticket.id === "book-ticket")?.issued ?? 0} book-inclusive tickets</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EventResultsTab({ operations }: { operations: EventOperationsPreview }) {
  const { results, luma, stage } = operations;
  const complete = stage === "Complete" || stage === "Reconciliation";
  const revenue = results.ticketRevenue + results.bookRevenue;
  const contribution = revenue - results.directCosts;
  if (!complete) {
    return (
      <div className="max-w-[900px]">
        <EmptyPanel icon='<path d="M4 19V9M10 19V5M16 19v-7M22 19V2"/>' title="Results open after the event" body="Attendance and ticket revenue will flow in from Luma. The event lead will only need to add walk-ins, book sales, direct costs and a short retrospective." />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MiniMetric label="Projected attendance" value={String(luma.approved)} detail={`${luma.capacity} capacity`} tone="rust" />
          <MiniMetric label="Ticket revenue" value={money(results.ticketRevenue)} detail="From current Luma mix" tone="green" />
          <MiniMetric label="Book commitments" value={String(luma.ticketTypes.find((ticket) => ticket.id === "book-ticket")?.issued ?? 0)} detail="Included with tickets" tone="gold" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex max-w-[1040px] flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Attendance" value={results.attendance + results.walkIns} detail={`${results.noShows} no-shows · ${results.walkIns} walk-ins`} accent={rust} />
        <MetricCard label="Books sold" value={results.booksSold} detail={`${results.attendance ? (results.booksSold / results.attendance).toFixed(2) : "0"} per attendee`} accent={gold} />
        <MetricCard label="Total revenue" value={money(revenue)} detail={`${money(results.bookRevenue)} from books`} accent={green} />
        <MetricCard label="Contribution" value={money(contribution)} detail={`After ${money(results.directCosts)} direct costs`} accent="#3D6670" />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <section className={panelCls}>
          <span className={panelHead}>Event retrospective</span>
          <textarea defaultValue={results.retrospective} className="min-h-[150px] w-full resize-y rounded-lg border border-cream-2 bg-cream px-4 py-3 text-[13.5px] leading-relaxed text-charcoal outline-none focus:border-rust" />
          <div className="mt-2 text-[11.5px] text-stone">Preview note only · not saved</div>
        </section>
        <section className={panelCls}>
          <span className={panelHead}>Close-out</span>
          <CloseRow label="Luma attendance synced" done />
          <CloseRow label="Stock reconciled" done={operations.stock.every((row) => row.status === "Reconciled")} />
          <CloseRow label="Sales report sent" done={false} />
          <CloseRow label="Retrospective captured" done={Boolean(results.retrospective)} />
          <button className="mt-4 w-full cursor-not-allowed rounded-md bg-rust px-4 py-2.5 text-[12.5px] font-semibold text-cream opacity-75">Mark event complete</button>
          <div className="mt-2 text-center text-[10.5px] text-stone">Disabled in safe preview mode</div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, accent }: { label: string; value: string | number; detail: string; accent: string }) {
  return <div className="relative overflow-hidden rounded-[11px] border border-cream-2 bg-white px-4 py-4"><span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} /><div className="eyebrow mb-2 text-stone">{label}</div><div className="font-display text-[28px] leading-none tabular-nums">{value}</div><div className="mt-2 text-[11.5px] text-stone">{detail}</div></div>;
}

function MiniMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "rust" | "gold" | "green" | "stone" }) {
  const colors = { rust: "#AD3B28", gold: "#B0812F", green: "#5F7355", stone: "#8C857C" };
  return <div className="rounded-[10px] border border-cream-2 bg-white px-4 py-3.5"><div className="eyebrow mb-1.5 text-stone">{label}</div><div className="font-display text-[24px] leading-none" style={{ color: colors[tone] }}>{value}</div><div className="mt-1.5 text-[11.5px] text-stone">{detail}</div></div>;
}

function HealthRow({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="flex items-center justify-between border-b border-cream-2 py-2.5 last:border-0"><span className="flex items-center gap-2 text-[12.5px] text-charcoal"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span><span className="font-display text-base tabular-nums">{value}</span></div>;
}

function CloseRow({ label, done }: { label: string; done: boolean }) {
  return <div className="flex items-center justify-between border-b border-cream-2 py-2.5 text-[12.5px]"><span className={done ? "text-charcoal" : "text-stone"}>{label}</span><span className={`flex h-5 w-5 items-center justify-center rounded-full ${done ? "bg-[#5F735518] text-[#5F7355]" : "bg-cream text-stone"}`}>{done ? icon('<path d="M6.5 12.5l3.2 3.2 7.8-8"/>', 12) : "–"}</span></div>;
}

function CategoryPill({ category, compact = false }: { category: EventTaskPreview["category"]; compact?: boolean }) {
  const palette: Record<EventTaskPreview["category"], string> = { Event: "bg-shell text-rust", Marketing: "bg-[#B0812F14] text-[#8a6420]", Stock: "bg-[#3D667014] text-[#3D6670]", People: "bg-[#6C5A8214] text-[#6C5A82]", Venue: "bg-[#5F735514] text-[#5F7355]", "Follow-up": "bg-cream text-stone" };
  return <span className={`${compact ? "hidden sm:inline-flex" : "inline-flex"} rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${palette[category]}`}>{category}</span>;
}

function EmptyPanel({ icon: iconPath, title, body }: { icon: string; title: string; body: string }) {
  return <div className="rounded-[13px] border border-dashed border-cream-2 bg-white px-6 py-10 text-center"><div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-shell text-rust">{icon(iconPath, 21)}</div><div className="font-display text-xl">{title}</div><p className="mx-auto mb-0 mt-2 max-w-[520px] text-[13px] leading-relaxed text-stone">{body}</p></div>;
}

function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function formatShortDate(iso: string) { return iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "TBC"; }
function formatLongDate(iso: string) { return iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "TBC"; }
function relativeTime(iso: string) { if (!iso) return "never"; const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000)); return mins < 1 ? "just now" : `${mins} min ago`; }
function money(value: number) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value); }
