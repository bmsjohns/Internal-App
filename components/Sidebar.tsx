"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Order, SessionUser } from "@/lib/types";
import { canonicalStatus, VENUES, initialsOf } from "@/lib/config";
import { useVenue, type VenueSelection } from "./VenueContext";

const ic = (p: string, size = 19) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: p }} />
);

// Icon set from the nav redesign ("Management Dashboard.dc.html").
const I = {
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M5 5l1.7 1.7M17.3 17.3L19 19M19 5l-1.7 1.7M6.7 17.3L5 19"/>',
  send: '<path d="M4 12l16-8-6 16-3-6z"/>',
  customer: '<circle cx="12" cy="8" r="4"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/>',
  cart: '<path d="M3 3h2l2.4 12.5a1.5 1.5 0 0 0 1.5 1.2h8.7"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M6.5 6.5h13l-1.5 7h-10z"/>',
  staging: '<path d="M4 4h13l3 3v13H4z"/><path d="M8 11h8M8 15h5"/>',
  pending: '<path d="M3 3h2l2.4 12.5a1.5 1.5 0 0 0 1.5 1.2h8.7"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/>',
  clock: '<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>',
  box: '<path d="M4 7l8-4 8 4-8 4z"/><path d="M4 7v10l8 4 8-4V7"/>',
  book: '<path d="M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 3v18"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  pitch: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  mapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>',
  school: '<path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11v5c0 1 5 3 5 3s5-2 5-3v-5"/>',
  clubs: '<path d="M4 5h13a2 2 0 0 1 2 2v13H6a2 2 0 0 1-2-2z"/><path d="M4 5a2 2 0 0 1 2-2h9"/>',
  members: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3 2.9-5 6.5-5s6.5 2 6.5 5"/><path d="M16 5.2A3.2 3.2 0 0 1 16 11"/>',
  card: '<path d="M3 10h18M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>',
  ret: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5 5 5 0 0 1-5 5H8"/>',
  pick: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h6v2"/><path d="M9 13l2 2 4-4"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7" y="12" width="3" height="6" rx="0.6"/><rect x="12" y="8" width="3" height="10" rx="0.6"/><rect x="17" y="14" width="3" height="4" rx="0.6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  pin: '<path d="M9 4v6l-2 3v2h10v-2l-2-3V4"/><path d="M8 4h8"/><path d="M12 17v5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  chevronsL: '<path d="M11 6l-6 6 6 6"/><path d="M18 6l-6 6 6 6"/>',
  chevronsR: '<path d="M13 6l6 6-6 6"/><path d="M6 6l6 6-6 6"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
};

// Badge keys map to /api/nav-counts fields; needsOrdering is computed
// client-side from the (throttled) orders list. warn = red badge, otherwise
// quiet. Collapsed groups aggregate only their warn counts, shown red.
type BadgeKey = "failedPayments" | "drafts" | "pending" | "outstanding" | "returnsStaging" | "returnsOutstanding" | "returnsPick" | "needsOrdering";

interface NavLeaf {
  href: string;
  label: string;
  icon: string;
  /** Checked against SessionUser.permissions (legacy-compatible strings). */
  permission?: string;
  adminOnly?: boolean;
  badge?: BadgeKey;
  warn?: boolean;
  /** Extra words the ⌘K jump should match beyond the label. */
  terms?: string;
}

type NavNode =
  | { type: "link"; leaf: NavLeaf }
  | { type: "group"; key: string; label: string; icon: string; children: NavLeaf[]; soon?: { label: string; icon: string }[] };

// Grouped IA per nav-redesign-spec.md: Ordering Hub is top-level (not nested
// under Orders); To Order left the nav (it's the button on /orders); per-event
// areas live in the event record's own tabs, not here.
const TREE: NavNode[] = [
  { type: "link", leaf: { href: "/briefing", label: "Today", icon: I.sun, permission: "briefing.view", terms: "daily briefing home" } },
  { type: "link", leaf: { href: "/orders", label: "Customer Orders", icon: I.send, permission: "orders.view", badge: "needsOrdering", warn: true, terms: "special order book" } },
  { type: "link", leaf: { href: "/customers", label: "Customers", icon: I.customer, permission: "customers.view" } },
  {
    type: "group", key: "ordering", label: "Ordering Hub", icon: I.cart,
    children: [
      { href: "/ordering/staging", label: "Staging", icon: I.staging, permission: "hub:view", badge: "drafts", warn: true },
      { href: "/ordering/pending", label: "Pending queue", icon: I.pending, permission: "hub:view", badge: "pending" },
      { href: "/ordering/outstanding", label: "Awaiting delivery", icon: I.clock, permission: "hub:view", badge: "outstanding" },
      { href: "/ordering/restock", label: "Restock", icon: I.box, permission: "hub:view" },
      { href: "/ordering/publishers", label: "Publishers", icon: I.book, permission: "hub:view" },
    ],
  },
  {
    type: "group", key: "events", label: "Events", icon: I.calendar,
    children: [
      { href: "/pitching", label: "Pitching", icon: I.pitch, permission: "pitching:view" },
      { href: "/events", label: "Events", icon: I.calendar, permission: "events:view", terms: "calendar shows" },
      { href: "/venues", label: "Venues", icon: I.mapPin, permission: "events:view" },
      { href: "/hosts", label: "Hosts", icon: I.mic, permission: "events:view" },
    ],
    soon: [{ label: "Schools & Signed Copies", icon: I.school }],
  },
  {
    type: "group", key: "clubs", label: "Book clubs", icon: I.clubs,
    children: [
      { href: "/clubs", label: "Clubs", icon: I.clubs, permission: "clubs:view" },
      { href: "/members", label: "Members", icon: I.members, permission: "clubs:view" },
      { href: "/failed-payments", label: "Failed payments", icon: I.card, permission: "clubs:view", badge: "failedPayments", warn: true },
    ],
  },
  {
    type: "group", key: "returns", label: "Returns", icon: I.ret,
    children: [
      { href: "/returns/staging", label: "To be returned", icon: I.ret, permission: "returns.view", badge: "returnsStaging" },
      { href: "/returns/picklists", label: "Pick lists", icon: I.pick, permission: "returns.view", badge: "returnsPick", warn: true },
      { href: "/returns", label: "Awaiting resolution", icon: I.clock, permission: "returns.view", badge: "returnsOutstanding" },
    ],
  },
  {
    type: "group", key: "insights", label: "Insights", icon: I.chart,
    children: [{ href: "/dashboard", label: "Management Dashboard", icon: I.grid, permission: "dashboard.view", terms: "insights reports sales" }],
  },
];

const SETTINGS_LEAF: NavLeaf = { href: "/settings", label: "Settings", icon: I.gear, adminOnly: true, terms: "permissions team suppliers" };
// Reachable from the Orders page button, so out of the tree — but the jump
// search should still find it.
const SEARCH_ONLY: NavLeaf[] = [
  { href: "/to-order", label: "To Order", icon: I.cart, permission: "orders.view", badge: "needsOrdering", warn: true, terms: "supplier ordering" },
];

// Mobile bottom tab bar (fixed slots per the redesign); disallowed tabs drop
// out and "More" always remains.
const TABS = [
  { href: "/briefing", prefix: "/briefing", label: "Today", icon: I.sun, permission: "briefing.view" },
  { href: "/ordering/staging", prefix: "/ordering", label: "Ordering", icon: I.cart, permission: "hub:view", badge: "drafts" as BadgeKey },
  { href: "/events", prefix: "/events", label: "Events", icon: I.calendar, permission: "events:view" },
  { href: "/returns/staging", prefix: "/returns", label: "Returns", icon: I.ret, permission: "returns.view", badge: "returnsPick" as BadgeKey },
];

// Location segmented control — venues on the outside, "Both" in the middle
// (spec: not "All venues" first). Active segment fills with brand colour.
const SEGS: { key: VenueSelection; label: string; color: string; title: string }[] = [
  { key: "simply", label: "Simply", color: "#378573", title: "Simply Books · Bramhall" },
  { key: "all", label: "Both", color: "#3a322c", title: "Both venues" },
  { key: "prologue", label: "Prologue", color: "#ad3b28", title: "Prologue · Weir Mill" },
];

const NAV_COUNTS_REFRESH_MS = 30_000;
const navCountsCache = new Map<VenueSelection, { at: number; counts: Record<string, number> }>();

// The sidebar re-renders on every navigation; without a throttle each click
// hit /api/orders (two Airtable list reads) and quick navigation tripped
// Airtable's 5 req/s limit. Module-level so the cache survives remounts;
// counts refresh at most every 30s per tab.
const ORDERS_REFRESH_MS = 30_000;
let ordersCache: { at: number; orders: Order[] } | null = null;

const NAV_STATE_KEY = "bs-nav";

// Standalone, chrome-free surfaces: the day-of call sheet (its own access
// tier + offline shell) and the printable call sheet.
export function isBareRoute(pathname: string): boolean {
  return pathname.startsWith("/callsheet") || /^\/events\/[^/]+\/print/.test(pathname);
}

function roleLine(user: SessionUser): string {
  const names: Record<string, string> = { admin: "Admin", manager: "Manager", "events-lead": "Events Lead", "bar-floor-staff": "Bar / Floor Staff", "book-club-manager": "Book Club Manager" };
  return `${names[user.role] ?? user.role} · ${user.locations.length === 2 ? "both venues" : user.locations[0]}`;
}

export default function Sidebar({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { venue, setVenue } = useVenue();
  const [orders, setOrders] = useState<Order[]>([]);
  const [navCounts, setNavCounts] = useState<Record<string, number>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [pins, setPins] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [navCountsError, setNavCountsError] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const bare = isBareRoute(pathname);

  useEffect(() => {
    if (ordersCache && Date.now() - ordersCache.at < ORDERS_REFRESH_MS) {
      setOrders(ordersCache.orders);
      return;
    }
    fetch("/api/orders")
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((d) => {
        const orders: Order[] = d.orders ?? [];
        ordersCache = { at: Date.now(), orders };
        setOrders(orders);
      })
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAV_STATE_KEY);
      if (saved) {
        const s = JSON.parse(saved);
        if (s.sections) setOpenGroups(s.sections);
        if (typeof s.collapsed === "boolean") setCollapsed(s.collapsed);
        if (Array.isArray(s.pins)) setPins(s.pins.filter((p: unknown) => typeof p === "string"));
        return;
      }
      // Pre-redesign key held only the group toggle state.
      const legacy = localStorage.getItem("ob-nav-groups");
      if (legacy) setOpenGroups(JSON.parse(legacy));
    } catch {}
  }, []);

  const save = (patch: { sections?: Record<string, boolean>; collapsed?: boolean; pins?: string[] }) => {
    try {
      localStorage.setItem(NAV_STATE_KEY, JSON.stringify({ sections: patch.sections ?? openGroups, collapsed: patch.collapsed ?? collapsed, pins: patch.pins ?? pins }));
    } catch {}
  };

  useEffect(() => {
    const cached = navCountsCache.get(venue);
    if (cached && Date.now() - cached.at < NAV_COUNTS_REFRESH_MS) {
      setNavCounts(cached.counts);
      return;
    }
    fetch(`/api/nav-counts?venue=${venue}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Navigation counts failed (${r.status})`);
        return r.json();
      })
      .then((counts: Record<string, number>) => {
        navCountsCache.set(venue, { at: Date.now(), counts });
        setNavCounts(counts);
        setNavCountsError(false);
      })
      .catch(() => setNavCountsError(true));
  }, [pathname, venue]);

  useEffect(() => setSheetOpen(false), [pathname]);

  // ⌘K / Ctrl-K focuses the jump field (expanding the rail first if needed).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCollapsed(false);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Location-scoped people see their own venue only — no switcher, and the
  // shared venue selection is clamped so "All venues" never bleeds through.
  const singleVenue: VenueSelection | null =
    user && user.locations.length === 1 ? (user.locations[0] === "Simply Books" ? "simply" : "prologue") : null;
  useEffect(() => {
    if (singleVenue && venue !== singleVenue) setVenue(singleVenue);
  }, [singleVenue, venue, setVenue]);

  const canAdmin = !!user && (user.permissions.includes("settings:manage") || user.permissions.includes("team.manage"));
  const visible = (l: NavLeaf) => (l.adminOnly ? canAdmin : !!user?.permissions.includes(l.permission ?? ""));

  const venueLabel = venue === "all" ? null : VENUES[venue].label;
  const needsCount = orders.filter((o) => (!venueLabel || o.location === venueLabel) && canonicalStatus(o.status).key === "needs-ordering").length;
  const counts: Record<string, number> = { ...navCounts, needsOrdering: needsCount };
  const badgeOf = (l: NavLeaf) => (l.badge ? counts[l.badge] ?? 0 : 0);

  const groups = TREE.filter((n): n is Extract<NavNode, { type: "group" }> => n.type === "group")
    .map((g) => ({ ...g, children: g.children.filter(visible) }))
    .filter((g) => g.children.length > 0);
  // Children inherit their section label as search terms so "returns" finds
  // every Returns page, not just labels containing the word.
  const treeLeaves = TREE.flatMap((n) =>
    n.type === "link" ? (visible(n.leaf) ? [n.leaf] : []) : n.children.filter(visible).map((c) => ({ ...c, terms: `${n.label} ${c.terms ?? ""}` }))
  );
  const allLeaves = [...treeLeaves, ...SEARCH_ONLY.filter(visible), ...(canAdmin ? [SETTINGS_LEAF] : [])];

  // Longest match wins so /returns doesn't claim /returns/staging.
  const bestMatch = allLeaves
    .filter((l) => pathname.startsWith(l.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const q = query.trim().toLowerCase();
  const results = q ? allLeaves.filter((l) => `${l.label} ${l.terms ?? ""}`.toLowerCase().includes(q)) : [];
  const pinnedLeaves = pins.map((href) => allLeaves.find((l) => l.href === href)).filter((l): l is NavLeaf => !!l);

  const toggleGroup = (key: string) => {
    setOpenGroups((g) => {
      const next = { ...g, [key]: !isOpen(key, g) };
      save({ sections: next });
      return next;
    });
  };
  const isOpen = (key: string, state = openGroups) => {
    const inside = groups.find((g) => g.key === key)?.children.some((c) => c.href === bestMatch) ?? false;
    return state[key] ?? inside;
  };
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      save({ collapsed: !c });
      return !c;
    });
  };
  const togglePin = (href: string) => {
    setPins((p) => {
      const next = p.includes(href) ? p.filter((x) => x !== href) : [...p, href];
      save({ pins: next });
      return next;
    });
  };

  const badgeCls = (warn?: boolean) =>
    `min-w-5 rounded-full px-2 py-px text-center text-[11px] font-semibold tabular-nums ${warn ? "bg-rust text-cream" : "bg-cream-2 text-charcoal"}`;

  // A leaf row: link + hover-reveal pin toggle. Shared by the tree, pinned
  // section, search results and the mobile sheet (where pins stay visible —
  // no hover on touch).
  const leafRow = (l: NavLeaf, opts: { child?: boolean; inSheet?: boolean } = {}) => {
    const active = l.href === bestMatch;
    const badge = badgeOf(l);
    const pinned = pins.includes(l.href);
    return (
      <div key={l.href} className="group/leaf flex items-center gap-px">
        <Link
          href={l.href}
          className={`flex min-w-0 flex-1 items-center rounded-md transition-colors ${opts.child ? "gap-2.5 px-2.5 py-2 text-[13.5px]" : "gap-3 px-3 py-[9px] text-sm"} ${
            active ? "bg-shell font-semibold text-rust" : "font-medium text-charcoal hover:bg-ink/5"
          }`}
        >
          {!opts.child && <span className="flex w-5 shrink-0 justify-center">{ic(l.icon)}</span>}
          <span className="flex-1 truncate">{l.label}</span>
          {badge > 0 && <span className={badgeCls(l.warn)}>{badge}</span>}
        </Link>
        <button
          type="button"
          onClick={() => togglePin(l.href)}
          title={pinned ? "Unpin" : "Pin"}
          aria-label={`${pinned ? "Unpin" : "Pin"} ${l.label}`}
          className={`flex h-[30px] w-[26px] shrink-0 items-center justify-center rounded-md transition-opacity hover:bg-ink/5 ${
            pinned ? "text-rust opacity-100" : `text-stone ${opts.inSheet ? "opacity-60" : "opacity-0 hover:opacity-100 group-hover/leaf:opacity-60"}`
          }`}
        >
          {ic(I.pin, 15)}
        </button>
      </div>
    );
  };

  // Grouped, accordion nav tree — shared by the desktop sidebar and the
  // mobile "More" sheet.
  const navTree = (inSheet: boolean) => (
    <>
      {pinnedLeaves.length > 0 && (
        <>
          <div className="eyebrow mx-1 mb-2 flex items-center gap-1.5 text-stone">{ic(I.pin, 12)}Pinned</div>
          {pinnedLeaves.map((l) => leafRow(l, { inSheet }))}
          <div className="mx-1 my-2.5 h-px bg-cream-2" />
        </>
      )}
      {TREE.map((node) => {
        if (node.type === "link") return visible(node.leaf) ? leafRow(node.leaf, { inSheet }) : null;
        const g = groups.find((x) => x.key === node.key);
        if (!g) return null;
        const open = isOpen(g.key);
        const inside = g.children.some((c) => c.href === bestMatch);
        const warnSum = g.children.reduce((sum, c) => sum + (c.warn ? badgeOf(c) : 0), 0);
        return (
          <div key={g.key}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`nav-group-${inSheet ? "m-" : ""}${g.key}`}
              onClick={() => toggleGroup(g.key)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-[9px] text-sm transition-colors ${
                inside && !open ? "bg-shell font-semibold text-rust" : "font-medium text-charcoal hover:bg-ink/5"
              }`}
            >
              <span className="flex w-5 shrink-0 justify-center">{ic(g.icon)}</span>
              <span className="flex-1 text-left">{g.label}</span>
              {!open && warnSum > 0 && <span className={badgeCls(true)}>{warnSum}</span>}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-stone transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            {open && (
              <div id={`nav-group-${inSheet ? "m-" : ""}${g.key}`} className="nav-subnav mb-1 ml-[22px] flex flex-col gap-0.5 border-l border-cream-2 pl-2 pt-0.5">
                {g.children.map((c) => leafRow(c, { child: true, inSheet }))}
                {g.soon?.map((m) => (
                  <span key={m.label} className="flex w-full cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium text-charcoal/60">
                    <span className="flex-1 truncate">{m.label}</span>
                    <span className="rounded-full border border-cream-2 px-[5px] py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-stone">Soon</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );

  // Single-line segmented location control (spec: Simply | Both | Prologue,
  // active segment inset in the location's brand colour).
  const venueControl = (
    <div role="radiogroup" aria-label="Viewing location" className="grid grid-cols-3 gap-0.5 rounded-full bg-cream-2 p-[3px] shadow-[inset_0_1px_2px_rgba(20,17,13,0.1)]">
      {SEGS.map((s) => {
        const active = venue === s.key;
        return (
          <button
            key={s.key}
            type="button"
            role="radio"
            aria-checked={active}
            title={s.title}
            onClick={() => setVenue(s.key)}
            className={`flex items-center justify-center gap-[7px] whitespace-nowrap rounded-full px-1 py-[7px] text-xs font-semibold transition-all duration-200 ${
              active ? "text-cream shadow-[inset_0_1px_3px_rgba(20,17,13,0.3)]" : "text-charcoal hover:bg-ink/5"
            }`}
            style={active ? { background: s.color } : undefined}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: active ? "#fff" : s.color }} />
            {s.label}
          </button>
        );
      })}
    </div>
  );

  const settingsLink = (inSheet: boolean) => (
    <Link
      href="/settings"
      className={`flex w-full items-center gap-3 rounded-md px-3 py-[9px] text-sm transition-colors ${
        pathname.startsWith("/settings") ? "bg-shell font-semibold text-rust" : "font-medium text-charcoal hover:bg-ink/5"
      }`}
    >
      <span className="flex w-5 shrink-0 justify-center">{ic(I.gear)}</span>
      <span className="flex-1">Settings</span>
      {!inSheet && <span className="sr-only">(admin)</span>}
    </Link>
  );

  const tabs = TABS.filter((t) => user?.permissions.includes(t.permission));
  const currentLeaf = allLeaves.find((l) => l.href === bestMatch);
  const topbarTitle = currentLeaf?.label ?? (pathname.startsWith("/settings") ? "Settings" : "Backstage");
  const currentSeg = SEGS.find((s) => s.key === venue) ?? SEGS[1];

  if (bare) return null;

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-[52px] items-center gap-3 border-b border-cream-2 bg-white px-3 lg:hidden">
        <Image src="/assets/p-mark-red.png" alt="" width={22} height={29} />
        <div className="min-w-0 flex-1 truncate font-display text-[17px] text-ink">{topbarTitle}</div>
        {singleVenue ? (
          <span className="flex items-center gap-2 rounded-full border border-cream-2 bg-cream px-3 py-1.5 text-xs font-semibold text-charcoal">
            <span className="h-2 w-2 rounded-full" style={{ background: currentSeg.color }} />
            {currentSeg.label}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            title="Switch location"
            className="flex items-center gap-2 rounded-full border border-cream-2 bg-cream px-3 py-1.5 text-xs font-semibold text-charcoal"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: currentSeg.color }} />
            {currentSeg.label}
          </button>
        )}
      </div>

      {/* Mobile "More" sheet */}
      {sheetOpen && (
        <div className="nav-overlay fixed inset-0 z-[70] bg-ink/40 lg:hidden" onClick={() => setSheetOpen(false)}>
          <div className="nav-sheet absolute inset-0 flex flex-col bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-cream-2 px-4 py-4">
              <div className="flex items-center gap-2.5">
                <Image src="/assets/p-mark-red.png" alt="" width={22} height={29} />
                <div className="font-display text-[19px] text-ink">All areas</div>
              </div>
              <button type="button" aria-label="Close menu" onClick={() => setSheetOpen(false)} className="flex rounded-md p-1.5 text-stone hover:bg-ink/5">
                {ic(I.x, 18)}
              </button>
            </div>
            {!singleVenue && <div className="px-4 pb-3 pt-3.5">{venueControl}</div>}
            <div className="mx-4 h-px bg-cream-2" />
            <nav aria-label="All areas" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-4 pb-6 pt-3.5">
              {navTree(true)}
              {canAdmin && (
                <>
                  <div className="mx-1 my-2.5 h-px bg-cream-2" />
                  {settingsLink(true)}
                </>
              )}
            </nav>
          </div>
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-cream-2 bg-white px-1.5 py-1.5 shadow-[0_-6px_18px_rgba(20,17,13,0.06)] lg:hidden">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.prefix);
          const badge = t.badge ? counts[t.badge] ?? 0 : 0;
          return (
            <Link key={t.href} href={t.href} className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 ${active ? "text-rust" : "text-stone"}`}>
              <span className="relative flex">
                {ic(t.icon, 22)}
                {badge > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full border-[1.5px] border-white bg-rust px-1 text-[9.5px] font-bold text-white">
                    {badge}
                  </span>
                )}
              </span>
              <span className="text-[10.5px] font-semibold">{t.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
          className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 ${sheetOpen ? "text-rust" : "text-stone"}`}
        >
          <span className="flex">{ic(I.more, 22)}</span>
          <span className="text-[10.5px] font-semibold">More</span>
        </button>
      </nav>

      {/* Desktop sidebar */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-cream-2 bg-white transition-[width] duration-300 lg:flex ${collapsed ? "w-[72px]" : "w-[256px]"}`}>
        {collapsed ? (
          <>
            <div className="flex flex-col items-center gap-3 border-b border-cream-2 pb-3 pt-[18px]">
              <Image src="/assets/p-mark-red.png" alt="Prologue" width={28} height={37} className="h-[28px] w-auto object-contain" />
              <button type="button" onClick={toggleCollapsed} title="Expand sidebar" className="flex rounded-lg p-2 text-stone hover:bg-ink/5">
                {ic(I.chevronsR, 18)}
              </button>
            </div>
            <nav aria-label="Main navigation" className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-3">
              {TREE.map((node) => {
                if (node.type === "link") {
                  if (!visible(node.leaf)) return null;
                  const l = node.leaf;
                  const active = l.href === bestMatch;
                  const dot = !!l.warn && badgeOf(l) > 0;
                  return (
                    <Link key={l.href} href={l.href} title={l.label} className={`relative flex h-11 w-11 items-center justify-center rounded-[10px] transition-colors ${active ? "bg-shell text-rust" : "text-charcoal hover:bg-ink/5"}`}>
                      {ic(l.icon)}
                      {dot && <span className="absolute right-[7px] top-[7px] h-[7px] w-[7px] rounded-full border-[1.5px] border-white bg-rust" />}
                    </Link>
                  );
                }
                const g = groups.find((x) => x.key === node.key);
                if (!g) return null;
                const inside = g.children.some((c) => c.href === bestMatch);
                const warnSum = g.children.reduce((sum, c) => sum + (c.warn ? badgeOf(c) : 0), 0);
                return (
                  <button
                    key={g.key}
                    type="button"
                    title={g.label}
                    onClick={() => {
                      setCollapsed(false);
                      setOpenGroups((s) => {
                        const next = { ...s, [g.key]: true };
                        save({ collapsed: false, sections: next });
                        return next;
                      });
                    }}
                    className={`relative flex h-11 w-11 items-center justify-center rounded-[10px] transition-colors ${inside ? "bg-shell text-rust" : "text-charcoal hover:bg-ink/5"}`}
                  >
                    {ic(g.icon)}
                    {warnSum > 0 && <span className="absolute right-[7px] top-[7px] h-[7px] w-[7px] rounded-full border-[1.5px] border-white bg-rust" />}
                  </button>
                );
              })}
            </nav>
            {canAdmin && (
              <div className="flex justify-center border-t border-cream-2 py-2">
                <Link href="/settings" title="Settings" className={`flex h-11 w-11 items-center justify-center rounded-[10px] transition-colors ${pathname.startsWith("/settings") ? "bg-shell text-rust" : "text-charcoal hover:bg-ink/5"}`}>
                  {ic(I.gear)}
                </Link>
              </div>
            )}
            <div className="flex justify-center border-t border-cream-2 py-3">
              {user ? (
                <span title={`${user.name} · ${roleLine(user)}`} className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-rust font-display text-[15px] text-cream">
                  {initialsOf(user.name)[0]}
                </span>
              ) : (
                <Link href="/sign-in" title="Sign in" className="text-sm font-semibold text-rust underline">→</Link>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-cream-2 px-5 pb-[15px] pt-[20px]">
              <Image src="/assets/p-mark-red.png" alt="Prologue" width={30} height={40} className="h-[30px] w-auto object-contain" />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="font-display text-[19px] text-ink">Backstage</div>
                <div className="eyebrow mt-0.5 text-stone">Ops platform</div>
              </div>
              <button type="button" onClick={toggleCollapsed} title="Collapse sidebar" className="flex shrink-0 rounded-lg p-1.5 text-stone hover:bg-ink/5">
                {ic(I.chevronsL, 18)}
              </button>
            </div>

            <div className="px-3.5 pb-2.5 pt-3.5">
              <div className="relative">
                <span className="pointer-events-none absolute left-[11px] top-1/2 flex -translate-y-1/2 text-stone">{ic(I.search, 16)}</span>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setQuery("");
                    if (e.key === "Enter" && results[0]) {
                      router.push(results[0].href);
                      setQuery("");
                    }
                  }}
                  placeholder="Jump to…"
                  aria-label="Jump to a page"
                  className="w-full rounded-lg border border-cream-2 bg-cream px-[34px] py-[9px] text-[13px] text-ink outline-none focus:border-stone"
                />
                {q ? (
                  <button type="button" onClick={() => setQuery("")} title="Clear" className="absolute right-1.5 top-1/2 flex -translate-y-1/2 rounded p-1 text-stone hover:bg-ink/5">
                    {ic(I.x, 16)}
                  </button>
                ) : (
                  <span className="absolute right-[9px] top-1/2 -translate-y-1/2 rounded-[5px] bg-cream-2 px-1.5 py-0.5 text-[10px] font-semibold text-stone">⌘K</span>
                )}
              </div>
            </div>

            {!singleVenue && <div className="px-3.5 pb-3">{venueControl}</div>}
            <div className="mx-3.5 h-px bg-cream-2" />

            <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3.5 pb-2 pt-3">
              {q ? (
                <>
                  <div className="eyebrow mx-1 mb-2 text-stone">Results</div>
                  {results.length === 0 && <div className="px-1 py-1.5 text-[13px] text-stone">Nothing matches “{query}”.</div>}
                  {results.map((l) => leafRow(l))}
                </>
              ) : (
                navTree(false)
              )}
            </nav>

            {canAdmin && <div className="border-t border-cream-2 px-3.5 py-2">{settingsLink(false)}</div>}

            <div className="flex items-center gap-2.5 border-t border-cream-2 px-4 py-3.5">
              {navCountsError && <span className="sr-only" role="status">Navigation counts could not be refreshed</span>}
              {user ? (
                <>
                  <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-rust font-display text-[15px] text-cream">
                    {initialsOf(user.name)[0]}
                  </span>
                  <div className="flex-1 leading-tight">
                    <div className="text-[13px] font-semibold">{user.name}</div>
                    <div className="text-[11px] text-stone">{roleLine(user)}</div>
                  </div>
                </>
              ) : (
                <Link href="/sign-in" className="text-sm font-semibold text-rust underline">
                  Sign in
                </Link>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
