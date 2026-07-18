"use client";

import { useMemo, useState } from "react";
import type { HubLine } from "@/lib/types";
import { HUB_SOURCES } from "@/lib/hub";
import { useVenue } from "@/components/VenueContext";
import DataTable, { type FilterGroup } from "@/components/DataTable";
import { post, useHubData } from "@/components/clubs/data";
import { ModuleHeader, SourceBadge, Toast, useAccent, venueColor } from "@/components/clubs/ui";

// Outstanding orders — Flow C (spec C4): sent but not yet arrived; this is
// what gets chased. Arrival is ONE confirm per line or per selection — no
// partial receipts exist. Arrived status writes back to the originating
// record via the preserved source link.
export default function OutstandingPage() {
  const { venue } = useVenue();
  const { accent, accentSoft } = useAccent();
  const { data, error, refresh } = useHubData();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.lines.filter(
      (l) =>
        l.state === "ordered" &&
        (venue === "all" || l.account === (venue === "simply" ? "Simply Books" : "Prologue"))
    );
  }, [data, venue]);

  const pubName = (l: HubLine) => data?.publishers.find((p) => p.id === l.publisherId)?.name ?? "—";
  const daysOut = (l: HubLine) => Math.max(0, Math.floor((Date.now() - new Date(l.sentAt ?? l.createdAt).getTime()) / 864e5));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const arrive = async (ids: string[]) => {
    if (ids.length === 0 || busy) return;
    setBusy(true);
    try {
      const res = await post("/api/hub/arrive", { lineIds: ids });
      setSelected(new Set());
      refresh();
      showToast(
        res.writeBack?.length
          ? `Arrived — status written back to ${res.writeBack.length} customer order${res.writeBack.length === 1 ? "" : "s"}`
          : `Marked arrived (${res.arrived})`
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filterGroups: FilterGroup<HubLine>[] = [
    {
      id: "pub",
      label: "Publisher",
      chips: [...new Set(rows.map((l) => l.publisherId).filter((x): x is string => !!x))].map((pid) => ({
        key: pid,
        label: data?.publishers.find((p) => p.id === pid)?.name ?? pid,
        predicate: (l) => l.publisherId === pid,
      })),
    },
    {
      id: "age",
      label: "Outstanding",
      chips: [{ key: "old", label: "14+ days", predicate: (l) => daysOut(l) >= 14 }],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <ModuleHeader
        eyebrow="Ordering hub · flow C"
        title="Outstanding orders"
        subtitle="Sent but not yet arrived — this is what gets chased. Confirm arrival per line, or select several; there are no partial receipts."
      />
      {error ? (
        <p className="px-8 py-10 text-sm font-semibold text-rust">{error}</p>
      ) : !data ? (
        <p className="px-8 py-10 text-sm text-stone">Loading…</p>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(l) => l.id}
          accent={accent}
          accentSoft={accentSoft}
          storageKey="outstanding"
          searchPlaceholder="Search title or source"
          searchText={(l) => `${l.title} ${l.sourceLabel} ${pubName(l)}`}
          filterGroups={filterGroups}
          defaultSort={{ key: "days", dir: "desc" }}
          cardAccent={(l) => venueColor(l.account ?? "Prologue")}
          toolbarExtra={
            selected.size > 0 ? (
              <button
                onClick={() => arrive([...selected])}
                disabled={busy}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-[1.5px] px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
                style={{ background: accent, borderColor: accent }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Mark {selected.size} arrived
              </button>
            ) : undefined
          }
          columns={[
            {
              key: "sel",
              label: "",
              sortable: false,
              render: (l) => (
                <input
                  type="checkbox"
                  checked={selected.has(l.id)}
                  onChange={() => toggle(l.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 accent-current"
                  style={{ color: accent }}
                />
              ),
            },
            {
              key: "title",
              label: "Title / source",
              sortValue: (l) => l.title,
              render: (l) => (
                <div>
                  <div className="font-semibold">{l.title}</div>
                  <div className="text-xs text-stone">{l.sourceLabel}</div>
                </div>
              ),
            },
            { key: "pub", label: "Publisher", sortValue: pubName, render: (l) => <span className="text-charcoal">{pubName(l)}</span> },
            {
              key: "account",
              label: "Account",
              sortValue: (l) => l.account ?? "",
              render: (l) => <span className="text-xs">{l.account}</span>,
            },
            {
              key: "qty",
              label: "Qty",
              align: "center",
              sortValue: (l) => l.quantity,
              render: (l) => <span className="tabular-nums">×{l.quantity}</span>,
            },
            {
              key: "sent",
              label: "Sent",
              sortable: false,
              render: (l) => (
                <div className="text-charcoal">
                  {l.sentMethod} ·{" "}
                  {l.sentAt ? new Date(l.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                  <div className="text-[11px] text-stone">by {l.sentBy || "—"}</div>
                </div>
              ),
            },
            {
              key: "days",
              label: "Outstanding",
              align: "right",
              sortValue: daysOut,
              render: (l) => {
                const d = daysOut(l);
                return <span className={`font-semibold tabular-nums ${d > 14 ? "text-coral" : "text-charcoal"}`}>{d} days</span>;
              },
            },
            {
              key: "action",
              label: "",
              sortable: false,
              align: "right",
              render: (l) => (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    arrive([l.id]);
                  }}
                  disabled={busy}
                  className="inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent text-[12.5px] font-semibold disabled:opacity-50"
                  style={{ color: accent }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Mark arrived
                </button>
              ),
            },
          ]}
          card={(l) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{l.title}</div>
                <SourceBadge {...HUB_SOURCES[l.source]} />
              </div>
              <div className="mb-2 mt-0.5 text-xs text-stone">
                {pubName(l)} · {l.account} · ×{l.quantity}
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[13px] font-semibold tabular-nums ${daysOut(l) > 14 ? "text-coral" : "text-charcoal"}`}>
                  {daysOut(l)} days out
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    arrive([l.id]);
                  }}
                  className="cursor-pointer rounded-md border-[1.5px] border-cream-2 bg-white px-3 py-1.5 text-xs font-semibold text-charcoal"
                >
                  Mark arrived
                </button>
              </div>
            </div>
          )}
          empty={{ title: "Nothing outstanding.", body: "Everything sent has arrived. Nice.", image: "/assets/bird-reading.png" }}
          exportCsv={{
            filename: "outstanding-orders.csv",
            header: ["Title", "ISBN", "Qty", "Publisher", "Account", "Source", "Sent", "By", "Days outstanding"],
            row: (l) => [l.title, l.isbn, l.quantity, pubName(l), l.account ?? "", l.sourceLabel, l.sentAt?.slice(0, 10) ?? "", l.sentBy, daysOut(l)],
          }}
          footerLabel={(n) => `${n} outstanding`}
          footerRight="Hub owns arrival status — sources reflect it"
        />
      )}
      {toast && <Toast text={toast} />}
    </div>
  );
}
