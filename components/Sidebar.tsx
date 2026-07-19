"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Order, SessionUser } from "@/lib/types";
import { canonicalStatus, VENUES, initialsOf } from "@/lib/config";
import { useVenue, type VenueSelection } from "./VenueContext";

const ic = (p: string) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: p }} />
);

const MODULES = [
  { href: "/briefing", label: "Daily Briefing", permission: "briefing.view", icon: '<path d="M4 4h13l3 3v13H4z"/><path d="M8 9h9M8 13h9M8 17h6"/>' },
  { href: "/dashboard", label: "Dashboard", permission: "dashboard.view", icon: '<rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/>' },
  { href: "/orders", label: "Orders", permission: "orders.view", icon: '<path d="M4 4h13l3 3v13H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>' },
  { href: "/customers", label: "Customers", permission: "customers.view", icon: '<circle cx="12" cy="8" r="4"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/>' },
  { href: "/to-order", label: "Customer ordering", permission: "orders.view", icon: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>' },
];

// Events Phase 1 — only shown to the small pitching group (pitching:view).
const PITCHING_MODULE = {
  href: "/pitching",
  label: "Pitching",
  icon: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
};

const SETTINGS_ICON = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>';

// Events Phase 2 — shown to the events group (events:view).
const EVENTS_MODULES = [
  { href: "/events", label: "Events", icon: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>' },
  { href: "/venues", label: "Venues", icon: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>' },
  { href: "/hosts", label: "Hosts", icon: '<path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>' },
];

const COMING_SOON = [
  { label: "Schools", icon: '<path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11v5c0 1 5 3 5 3s5-2 5-3v-5"/>' },
];

// Book Clubs + Ordering Hub land as GROUPS with a sub-menu (Ben's ask:
// "clicking Ordering then seeing the different things in the ordering hub").
// A group auto-expands while you're inside it; its toggle state persists per
// device. Badge keys map to /api/nav-counts fields.
interface NavChild {
  href: string;
  label: string;
  icon: string;
  badge?:
    | "failedPayments"
    | "drafts"
    | "pending"
    | "outstanding"
    | "returnsOutstanding"
    | "returnsStaging"
    | "returnsPick";
  warn?: boolean;
}
interface NavGroup {
  key: string;
  label: string;
  icon: string;
  permission: string;
  children: NavChild[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: "clubs",
    label: "Book clubs",
    icon: '<path d="M4 5h13a2 2 0 0 1 2 2v13H6a2 2 0 0 1-2-2z"/><path d="M4 5a2 2 0 0 1 2-2h9"/>',
    permission: "clubs:view",
    children: [
      { href: "/clubs", label: "Clubs", icon: '<path d="M4 5h13a2 2 0 0 1 2 2v13H6a2 2 0 0 1-2-2z"/><path d="M4 5a2 2 0 0 1 2-2h9"/>' },
      { href: "/members", label: "Members", icon: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3 2.9-5 6.5-5s6.5 2 6.5 5"/><path d="M16 5.2A3.2 3.2 0 0 1 16 11"/>' },
      { href: "/failed-payments", label: "Failed payments", icon: '<path d="M3 10h18M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>', badge: "failedPayments", warn: true },
    ],
  },
  {
    key: "ordering",
    label: "Ordering",
    icon: '<path d="M3 3h2l2.4 12.5a1.5 1.5 0 0 0 1.5 1.2h8.7"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M6.5 6.5h13l-1.5 7h-10z"/>',
    permission: "hub:view",
    children: [
      { href: "/ordering/staging", label: "Staging", icon: '<path d="M4 4h13l3 3v13H4z"/><path d="M8 11h8M8 15h5"/>', badge: "drafts" },
      { href: "/ordering/pending", label: "Pending queue", icon: '<path d="M3 3h2l2.4 12.5a1.5 1.5 0 0 0 1.5 1.2h8.7"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/>', badge: "pending" },
      { href: "/ordering/outstanding", label: "Awaiting delivery", icon: '<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>', badge: "outstanding" },
      { href: "/ordering/restock", label: "Restock", icon: '<path d="M4 7l8-4 8 4-8 4z"/><path d="M4 7v10l8 4 8-4V7"/>' },
      { href: "/ordering/publishers", label: "Publishers", icon: '<path d="M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 3v18"/>' },
    ],
  },
  {
    key: "returns",
    label: "Returns",
    icon: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5 5 5 0 0 1-5 5H8"/>',
    permission: "returns.view",
    children: [
      { href: "/returns/staging", label: "To be returned", icon: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5 5 5 0 0 1-5 5H8"/>', badge: "returnsStaging" },
      { href: "/returns/picklists", label: "Pick lists", icon: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h6v2"/><path d="M9 13l2 2 4-4"/>', badge: "returnsPick" },
      { href: "/returns", label: "Awaiting resolution", icon: '<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>', badge: "returnsOutstanding" },
    ],
  },
];

const NAV_COUNTS_REFRESH_MS = 30_000;
const navCountsCache = new Map<VenueSelection, { at: number; counts: Record<string, number> }>();

// The sidebar re-renders on every navigation; without a throttle each click
// hit /api/orders (two Airtable list reads) and quick navigation tripped
// Airtable's 5 req/s limit. Module-level so the cache survives remounts;
// counts refresh at most every 30s per tab.
const ORDERS_REFRESH_MS = 30_000;
let ordersCache: { at: number; orders: Order[] } | null = null;

function roleLine(user: SessionUser): string {
  const names: Record<string, string> = { admin: "Admin", manager: "Manager", "events-lead": "Events Lead", "bar-floor-staff": "Bar / Floor Staff", "book-club-manager": "Book Club Manager" };
  return `${names[user.role] ?? user.role} · ${user.locations.length === 2 ? "both venues" : user.locations[0]}`;
}

export default function Sidebar({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const { venue, setVenue } = useVenue();
  const [orders, setOrders] = useState<Order[]>([]);
  const [navCounts, setNavCounts] = useState<Record<string, number>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navCountsError, setNavCountsError] = useState(false);
  // Standalone, chrome-free surfaces: the day-of call sheet (its own access
  // tier + offline shell) and the printable call sheet.
  const bare = pathname.startsWith("/callsheet") || /^\/events\/[^/]+\/print/.test(pathname);

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
      const saved = localStorage.getItem("ob-nav-groups");
      if (saved) setOpenGroups(JSON.parse(saved));
    } catch {}
  }, []);

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

  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleGroup = (key: string) => {
    setOpenGroups((g) => {
      const next = { ...g, [key]: !g[key] };
      try {
        localStorage.setItem("ob-nav-groups", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const needsCount = orders.filter((o) => canonicalStatus(o.status).key === "needs-ordering").length;
  const canPitch = !!user?.permissions.includes("pitching:view");
  const canEvents = !!user?.permissions.includes("events:view");
  const modules = [
    ...MODULES.filter((module) => !!user?.permissions.includes(module.permission)),
    ...(canPitch ? [PITCHING_MODULE] : []),
    ...(canEvents ? EVENTS_MODULES : []),
  ];
  const venueOptions: { key: VenueSelection; label: string; dot: string; count: number }[] = [
    { key: "all", label: "All venues", dot: "#8C857C", count: orders.length },
    { key: "simply", label: "Simply Books", dot: VENUES.simply.color, count: orders.filter((o) => o.location === "Simply Books").length },
    { key: "prologue", label: "Prologue", dot: VENUES.prologue.color, count: orders.filter((o) => o.location === "Prologue").length },
  ];
  const mobileLinks = [
    ...modules,
    ...NAV_GROUPS.filter((group) => user?.permissions.includes(group.permission)).flatMap((group) => group.children),
  ];
  const mobileCurrent = mobileLinks
    .filter((item) => pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];

  const label = "eyebrow mx-1 mb-2 text-stone";

  if (bare) return null;

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-cream-2 bg-white px-3 py-2.5 lg:hidden">
        <Image src="/assets/p-mark-red.png" alt="" width={22} height={29} />
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMobileOpen((open) => !open)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-semibold text-charcoal hover:bg-shell"
        >
          <span aria-hidden>☰</span>
          <span className="truncate">{mobileCurrent?.label ?? (pathname.startsWith("/settings") ? "Settings" : "Backstage")}</span>
        </button>
        <label htmlFor="mobile-venue" className="sr-only">Viewing location</label>
        <select
          id="mobile-venue"
          aria-label="Viewing location"
          value={venue}
          onChange={(e) => setVenue(e.target.value as VenueSelection)}
          className="ml-auto rounded-md border border-cream-2 bg-white px-2 py-1.5 text-xs font-semibold text-charcoal"
        >
          <option value="all">All venues</option>
          <option value="simply">Simply Books</option>
          <option value="prologue">Prologue</option>
        </select>
      </div>
      {mobileOpen && (
        <div id="mobile-navigation" className="fixed inset-x-0 bottom-0 top-[52px] z-20 overflow-y-auto bg-white px-4 py-4 shadow-xl lg:hidden">
          <nav aria-label="Main navigation" className="grid grid-cols-2 gap-2">
            {mobileLinks.map((item) => (
              <Link key={item.href} href={item.href} className={`rounded-lg border px-3 py-3 text-sm font-semibold ${pathname.startsWith(item.href) ? "border-rust bg-shell text-rust" : "border-cream-2 text-charcoal"}`}>
                {item.label}
              </Link>
            ))}
            {(user?.permissions.includes("settings:manage") || user?.permissions.includes("team.manage")) && (
              <Link href="/settings" className="rounded-lg border border-cream-2 px-3 py-3 text-sm font-semibold text-charcoal">Settings</Link>
            )}
          </nav>
        </div>
      )}
      <div className="h-[52px] lg:hidden" aria-hidden />

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-cream-2 bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-cream-2 px-5 pb-[18px] pt-[22px]">
          <Image src="/assets/p-mark-red.png" alt="Prologue" width={30} height={40} className="h-[30px] w-auto object-contain" />
          <div className="leading-tight">
            <div className="font-display text-[19px] text-ink">Backstage</div>
            <div className="eyebrow mt-0.5 text-stone">Ops platform</div>
          </div>
        </div>

        <div className="px-4 pb-2 pt-4">
          <div className={label}>Viewing</div>
          <div className="flex flex-col gap-1">
            {venueOptions.map((v) => {
              const active = venue === v.key;
              return (
                <button
                  key={v.key}
                  onClick={() => setVenue(v.key)}
                  className={`flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left text-[13.5px] text-ink transition-colors ${
                    active ? "border-ink bg-white font-semibold" : "border-transparent hover:bg-ink/5"
                  }`}
                >
                  <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: v.dot }} />
                  <span className="flex-1">{v.label}</span>
                  <span className="text-[11px] tabular-nums text-stone">{v.count || ""}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-4 my-3 h-px bg-cream-2" />

        <nav className="flex flex-1 flex-col gap-0.5 px-4">
          <div className={label}>Modules</div>
          {modules.map((m) => {
            const active = pathname.startsWith(m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-[9px] text-sm transition-colors ${
                  active ? "bg-shell font-semibold text-rust" : "font-medium text-charcoal hover:bg-ink/5"
                }`}
              >
                <span className="flex w-5 justify-center">{ic(m.icon)}</span>
                <span className="flex-1">{m.label}</span>
                {m.href === "/to-order" && needsCount > 0 && (
                  <span className="min-w-5 rounded-full bg-rust px-2 py-px text-center text-[11px] font-semibold text-cream">
                    {needsCount}
                  </span>
                )}
              </Link>
            );
          })}
          {NAV_GROUPS.filter((g) => user?.permissions.includes(g.permission)).map((g) => {
            const inside = g.children.some((c) => pathname.startsWith(c.href));
            const open = openGroups[g.key] ?? inside;
            const groupBadge = g.children.reduce((sum, c) => sum + (c.badge ? (navCounts[c.badge] ?? 0) : 0), 0);
            return (
              <div key={g.key}>
                <button
                  aria-expanded={open}
                  aria-controls={`nav-group-${g.key}`}
                  onClick={() => toggleGroup(g.key)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-[9px] text-sm transition-colors ${
                    inside && !open ? "bg-shell font-semibold text-rust" : "font-medium text-charcoal hover:bg-ink/5"
                  }`}
                >
                  <span className="flex w-5 justify-center">{ic(g.icon)}</span>
                  <span className="flex-1 text-left">{g.label}</span>
                  {!open && groupBadge > 0 && (
                    <span className="min-w-5 rounded-full bg-cream-2 px-2 py-px text-center text-[11px] font-semibold tabular-nums text-charcoal">
                      {groupBadge}
                    </span>
                  )}
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"
                    className={`text-stone transition-transform ${open ? "rotate-90" : ""}`}
                  >
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
                {open && (
                  <div id={`nav-group-${g.key}`} className="mb-1 ml-[22px] flex flex-col gap-0.5 border-l border-cream-2 pl-2 pt-0.5">
                    {g.children.map((c) => {
                      // Longest match wins (see mobile bar note).
                      const best = g.children
                        .filter((o) => pathname.startsWith(o.href))
                        .sort((a, b) => b.href.length - a.href.length)[0]?.href;
                      const active = c.href === best;
                      const badge = c.badge ? (navCounts[c.badge] ?? 0) : 0;
                      return (
                        <Link
                          key={c.href}
                          href={c.href}
                          className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] transition-colors ${
                            active ? "bg-shell font-semibold text-rust" : "font-medium text-charcoal hover:bg-ink/5"
                          }`}
                        >
                          <span className="flex w-[18px] justify-center opacity-80">{ic(c.icon)}</span>
                          <span className="flex-1">{c.label}</span>
                          {badge > 0 && (
                            <span
                              className={`min-w-5 rounded-full px-2 py-px text-center text-[11px] font-semibold tabular-nums ${
                                c.warn ? "bg-rust text-cream" : "bg-cream-2 text-charcoal"
                              }`}
                            >
                              {badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {COMING_SOON.map((m) => (
            <span key={m.label} className="flex w-full cursor-default items-center gap-3 rounded-md px-3 py-[9px] text-sm font-medium text-charcoal/60">
              <span className="flex w-5 justify-center">{ic(m.icon)}</span>
              <span className="flex-1">{m.label}</span>
              <span className="rounded-full border border-cream-2 px-[5px] py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-stone">
                Soon
              </span>
            </span>
          ))}
          {(user?.permissions.includes("settings:manage") || user?.permissions.includes("team.manage")) && (
            <>
              <div className="mx-1 my-3 h-px bg-cream-2" />
              <Link
                href="/settings"
                className={`flex w-full items-center gap-3 rounded-md px-3 py-[9px] text-sm transition-colors ${
                  pathname.startsWith("/settings")
                    ? "bg-shell font-semibold text-rust"
                    : "font-medium text-charcoal hover:bg-ink/5"
                }`}
              >
                <span className="flex w-5 justify-center">{ic(SETTINGS_ICON)}</span>
                <span className="flex-1">Settings</span>
              </Link>
            </>
          )}
        </nav>

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
      </aside>
    </>
  );
}
