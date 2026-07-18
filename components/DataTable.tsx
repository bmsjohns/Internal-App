"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

// ---------------------------------------------------------------------------
// Shared list/table component — the A2 "data capability bar" built once and
// reused by every Book Clubs / Ordering Hub list view:
//   · search (partial, multi-field) · combinable chip filters, visibly
//     applied + clearable · per-column sort with indicator · CSV export of
//     the filtered rows · per-view persistence of search/filter/sort ·
//     mobile card fallback (no horizontal-scroll misery) · brand empty state
// Row cap keeps hundreds of rows fast; "Show all" lifts it on demand.
// ---------------------------------------------------------------------------

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
  /** Extra tailwind for the td (e.g. responsive hiding). */
  tdClass?: string;
  thClass?: string;
}

export interface FilterChip<T> {
  key: string;
  label: string;
  count?: number;
  predicate: (row: T) => boolean;
}

export interface FilterGroup<T> {
  id: string;
  label: string; // used in the "Applied" chips
  chips: FilterChip<T>[];
}

interface Persisted {
  search: string;
  sort: string | null;
  dir: "asc" | "desc";
  filters: Record<string, string | null>;
}

const ROW_CAP = 120;

export default function DataTable<T>({
  rows,
  rowKey,
  columns,
  searchText,
  searchPlaceholder = "Search",
  filterGroups = [],
  defaultSort = null,
  defaultFilters = {},
  storageKey,
  accent = "#AD3B28",
  accentSoft = "#FBEDEA",
  onRowClick,
  card,
  cardAccent,
  empty,
  footerRight,
  footerLabel = (n, total) => (n === total ? `${total} rows` : `${n} of ${total} rows`),
  exportCsv,
  toolbarExtra,
}: {
  rows: T[];
  rowKey: (row: T) => string;
  columns: Column<T>[];
  searchText: (row: T) => string;
  searchPlaceholder?: string;
  filterGroups?: FilterGroup<T>[];
  defaultSort?: { key: string; dir: "asc" | "desc" } | null;
  defaultFilters?: Record<string, string>;
  /** Persist search/filter/sort per view (A2) — omit to disable. */
  storageKey?: string;
  accent?: string;
  accentSoft?: string;
  onRowClick?: (row: T) => void;
  /** Mobile representation — required for any table with >3 columns. */
  card: (row: T) => React.ReactNode;
  cardAccent?: (row: T) => string;
  empty: { title: string; body: string; image?: string };
  footerRight?: React.ReactNode;
  footerLabel?: (visible: number, total: number) => string;
  exportCsv?: { filename: string; header: string[]; row: (r: T) => (string | number)[] };
  /** Extra controls rendered next to search (e.g. a bulk action). */
  toolbarExtra?: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string | null>(defaultSort?.key ?? null);
  const [dir, setDir] = useState<"asc" | "desc">(defaultSort?.dir ?? "asc");
  const [filters, setFilters] = useState<Record<string, string | null>>(defaultFilters);
  const [showAll, setShowAll] = useState(false);
  const restored = useRef(false);

  useEffect(() => {
    if (!storageKey || restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(`dt-${storageKey}`);
      if (!raw) return;
      const p: Persisted = JSON.parse(raw);
      setSearch(p.search ?? "");
      setSort(p.sort ?? defaultSort?.key ?? null);
      setDir(p.dir ?? defaultSort?.dir ?? "asc");
      setFilters(p.filters ?? defaultFilters);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !restored.current) return;
    try {
      localStorage.setItem(`dt-${storageKey}`, JSON.stringify({ search, sort, dir, filters } satisfies Persisted));
    } catch {}
  }, [storageKey, search, sort, dir, filters]);

  const filtered = useMemo(() => {
    let out = rows;
    for (const g of filterGroups) {
      const sel = filters[g.id];
      if (!sel) continue;
      const chip = g.chips.find((c) => c.key === sel);
      if (chip) out = out.filter(chip.predicate);
    }
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((r) => searchText(r).toLowerCase().includes(q));
    return out;
  }, [rows, filters, filterGroups, search, searchText]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort);
    if (!col?.sortValue) return filtered;
    const sv = col.sortValue;
    const mul = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let x = sv(a);
      let y = sv(b);
      if (typeof x === "string") {
        x = x.toLowerCase();
        y = String(y).toLowerCase();
      }
      return x < y ? -mul : x > y ? mul : 0;
    });
  }, [filtered, sort, dir, columns]);

  const visible = showAll ? sorted : sorted.slice(0, ROW_CAP);

  const applied = filterGroups.flatMap((g) => {
    const sel = filters[g.id];
    const chip = sel ? g.chips.find((c) => c.key === sel) : null;
    return chip ? [{ group: g, chip }] : [];
  });

  const toggleSort = (key: string) => {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir("asc");
    }
  };

  const doExport = () => {
    if (!exportCsv) return;
    const cell = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const text = [exportCsv.header.join(","), ...sorted.map((r) => exportCsv.row(r).map(cell).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = exportCsv.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chipStyle = (active: boolean): React.CSSProperties =>
    active
      ? { borderColor: accent, background: accent, color: "#fff" }
      : { borderColor: "var(--color-cream-2)", background: "#fff", color: "var(--color-charcoal)" };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-3 px-5 pt-4 sm:px-8">
        <div className="relative min-w-[220px] max-w-[400px] flex-1">
          <svg
            width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-md border border-cream-2 bg-white py-2.5 pl-9 pr-3 text-sm text-ink"
          />
        </div>
        {filterGroups.map((g) => (
          <div key={g.id} className="flex flex-wrap items-center gap-1.5">
            {g.chips.map((c) => {
              const active = filters[g.id] === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setFilters((f) => ({ ...f, [g.id]: active ? null : c.key }))}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-[7px] text-[12.5px] font-semibold"
                  style={chipStyle(active)}
                >
                  {c.label}
                  {c.count != null && c.count > 0 && (
                    <span className="tabular-nums opacity-60">{c.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {toolbarExtra}
          {exportCsv && (
            <button
              onClick={doExport}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-[1.5px] border-cream-2 bg-transparent px-3 py-2 text-[12.5px] font-semibold text-charcoal hover:border-ink hover:text-ink"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M12 3v12M7 10l5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* applied filters (A2: visibly persist, clear easily) */}
      {(applied.length > 0 || search.trim()) && (
        <div className="flex flex-wrap items-center gap-2 px-5 pt-3 sm:px-8">
          <span className="eyebrow text-stone">Applied</span>
          {search.trim() && (
            <button
              onClick={() => setSearch("")}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
              style={{ borderColor: accent, background: accentSoft, color: accent }}
            >
              “{search.trim()}”
              <span aria-hidden>×</span>
            </button>
          )}
          {applied.map(({ group, chip }) => (
            <button
              key={group.id}
              onClick={() => setFilters((f) => ({ ...f, [group.id]: null }))}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
              style={{ borderColor: accent, background: accentSoft, color: accent }}
            >
              {group.label}: {chip.label}
              <span aria-hidden>×</span>
            </button>
          ))}
          <button
            onClick={() => {
              setSearch("");
              setFilters({});
            }}
            className="cursor-pointer border-none bg-transparent text-xs text-stone underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* desktop table */}
      <div className="mt-1 flex-1">
        {sorted.length > 0 ? (
          <>
            <table className="hidden w-full border-collapse text-sm md:table">
              <thead>
                <tr className="text-left">
                  {columns.map((col) => {
                    const sortable = col.sortable !== false && !!col.sortValue;
                    const active = sort === col.key;
                    return (
                      <th
                        key={col.key}
                        onClick={sortable ? () => toggleSort(col.key) : undefined}
                        className={`eyebrow sticky top-0 z-[1] bg-cream px-3.5 py-3 font-semibold text-stone first:pl-5 last:pr-5 sm:first:pl-8 sm:last:pr-8 ${
                          sortable ? "cursor-pointer select-none hover:text-ink" : ""
                        } ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} ${col.thClass ?? ""}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortable && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={active ? "" : "opacity-30"}>
                              {active && dir === "desc" ? <path d="M6 9l6 6 6-6" /> : active ? <path d="M6 15l6-6 6 6" /> : <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />}
                            </svg>
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr
                    key={rowKey(r)}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    className={`border-b border-cream-2 bg-white ${onRowClick ? "cursor-pointer hover:bg-shell/50" : ""}`}
                  >
                    {columns.map((col, i) => (
                      <td
                        key={col.key}
                        className={`px-3.5 py-3 first:pl-5 last:pr-5 sm:first:pl-8 sm:last:pr-8 ${
                          col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""
                        } ${col.tdClass ?? ""}`}
                        style={i === 0 && cardAccent ? { borderLeft: `3px solid ${cardAccent(r)}` } : undefined}
                      >
                        {col.render(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* mobile cards */}
            <div className="flex flex-col gap-2.5 px-4 pb-4 pt-2 md:hidden">
              {visible.map((r) => (
                <div
                  key={rowKey(r)}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={`rounded-[10px] border border-cream-2 bg-white px-4 py-3.5 ${onRowClick ? "cursor-pointer" : ""}`}
                  style={cardAccent ? { borderLeft: `3px solid ${cardAccent(r)}` } : undefined}
                >
                  {card(r)}
                </div>
              ))}
            </div>

            {sorted.length > ROW_CAP && !showAll && (
              <div className="px-5 py-3 sm:px-8">
                <button
                  onClick={() => setShowAll(true)}
                  className="cursor-pointer rounded-md border-[1.5px] border-cream-2 bg-white px-4 py-2 text-[13px] font-semibold text-charcoal hover:border-ink"
                >
                  Show all {sorted.length}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <Image src={empty.image ?? "/assets/bird-perched.png"} alt="" width={104} height={104} className="mb-4 h-auto w-[104px] opacity-90" />
            <div className="font-display text-[23px] text-ink">{empty.title}</div>
            <p className="mt-1.5 max-w-[340px] text-sm text-charcoal">{empty.body}</p>
          </div>
        )}
      </div>

      {/* footer */}
      <div className="sticky bottom-0 flex items-center justify-between border-t border-cream-2 bg-white px-5 py-2.5 text-[12.5px] text-stone sm:px-8">
        <span>{footerLabel(sorted.length, rows.length)}</span>
        <span>{footerRight}</span>
      </div>
    </div>
  );
}
