"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Club } from "@/lib/types";
import { CLUB_STATUS, currentMonthKey } from "@/lib/clubs";
import { useVenue } from "@/components/VenueContext";
import DataTable, { type FilterGroup } from "@/components/DataTable";
import { useClubsData } from "@/components/clubs/data";
import { ModuleHeader, Tag, useAccent, venueColor } from "@/components/clubs/ui";

// Club list (spec B3): 30+ clubs, member counts and this month's
// book-selection status at a glance.
export default function ClubsPage() {
  const router = useRouter();
  const { venue } = useVenue();
  const { accent, accentSoft } = useAccent();
  const { data, error } = useClubsData();
  const month = currentMonthKey();

  const clubs = useMemo(() => {
    if (!data) return [];
    return data.clubs.filter(
      (c) => venue === "all" || c.location === (venue === "simply" ? "Simply Books" : "Prologue")
    );
  }, [data, venue]);

  const selOf = useMemo(() => {
    const m = new Map(data?.selections.filter((s) => s.month === month).map((s) => [s.clubId, s]) ?? []);
    return (c: Club) => m.get(c.id) ?? null;
  }, [data, month]);

  const counts = useMemo(() => {
    const active = new Map<string, number>();
    for (const s of data?.memberships ?? []) {
      if (s.status === "active") active.set(s.clubId, (active.get(s.clubId) ?? 0) + 1);
    }
    return { active: (c: Club) => active.get(c.id) ?? 0 };
  }, [data]);

  const filterGroups: FilterGroup<Club>[] = [
    {
      id: "status",
      label: "Status",
      chips: (["active", "paused", "inactive"] as const).map((st) => ({
        key: st,
        label: CLUB_STATUS[st].label,
        count: clubs.filter((c) => c.status === st).length,
        predicate: (c) => c.status === st,
      })),
    },
    {
      id: "pick",
      label: "This month",
      chips: [
        {
          key: "needs",
          label: "Needs pick",
          count: clubs.filter((c) => c.status === "active" && !selOf(c)).length,
          predicate: (c) => c.status === "active" && !selOf(c),
        },
        { key: "set", label: "Pick set", predicate: (c) => !!selOf(c) },
      ],
    },
  ];

  const pickCell = (c: Club) => {
    const sel = selOf(c);
    if (!sel)
      return (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-coral">
          <span className="h-[7px] w-[7px] rounded-full bg-coral" />
          Not yet picked
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-charcoal">
        <span className="h-[7px] w-[7px] rounded-full bg-[#4E8D6E]" />
        {sel.title}
      </span>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <ModuleHeader
        eyebrow="Book clubs"
        title="Clubs"
        subtitle={
          data
            ? `${clubs.length} clubs across ${venue === "all" ? "both venues" : venue === "simply" ? "Simply Books" : "Prologue"}. Each club picks one book a month — counts and this month's pick at a glance.`
            : "Loading…"
        }
      />
      {error ? (
        <p className="px-8 py-10 text-sm font-semibold text-rust">{error}</p>
      ) : !data ? (
        <p className="px-8 py-10 text-sm text-stone">Loading…</p>
      ) : (
        <DataTable
          rows={clubs}
          rowKey={(c) => c.id}
          onRowClick={(c) => router.push(`/clubs/${c.id}`)}
          accent={accent}
          accentSoft={accentSoft}
          storageKey="clubs"
          searchPlaceholder="Search club, genre or cadence"
          searchText={(c) => `${c.name} ${c.genre} ${c.cadence}`}
          filterGroups={filterGroups}
          defaultSort={{ key: "name", dir: "asc" }}
          cardAccent={(c) => venueColor(c.location)}
          columns={[
            {
              key: "name",
              label: "Club",
              sortValue: (c) => c.name,
              render: (c) => (
                <div>
                  <div className="font-display text-[17px] leading-tight text-ink">{c.name}</div>
                  <div className="mt-0.5 text-xs text-stone">{c.cadence}</div>
                </div>
              ),
            },
            {
              key: "venue",
              label: "Venue",
              sortValue: (c) => c.location,
              render: (c) => <span className="text-[12.5px] text-charcoal">{c.location}</span>,
            },
            {
              key: "genre",
              label: "Genre",
              sortValue: (c) => c.genre,
              render: (c) => (
                <span className="whitespace-nowrap rounded-full border border-cream-2 bg-cream px-2.5 py-1 text-xs text-charcoal">
                  {c.genre}
                </span>
              ),
            },
            {
              key: "members",
              label: "Members",
              align: "right",
              sortValue: (c) => counts.active(c),
              render: (c) => (
                <span className="tabular-nums">
                  <span className="text-[15px] font-semibold">{counts.active(c)}</span>
                  <span className="text-xs text-stone"> / {c.memberCapacity ?? "—"}</span>
                </span>
              ),
            },
            { key: "pick", label: "This month", sortable: false, render: pickCell },
            {
              key: "status",
              label: "Status",
              sortValue: (c) => c.status,
              render: (c) => <Tag {...CLUB_STATUS[c.status]} />,
            },
          ]}
          card={(c) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="font-display text-lg text-ink">{c.name}</div>
                <Tag {...CLUB_STATUS[c.status]} />
              </div>
              <div className="mb-2 mt-1 text-[12.5px] text-stone">
                {c.location} · {c.genre} · {c.cadence}
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span>
                  <strong className="tabular-nums">{counts.active(c)}</strong> active / {c.memberCapacity ?? "—"}
                </span>
                {pickCell(c)}
              </div>
            </div>
          )}
          empty={{ title: "No clubs match.", body: "Try a different status or clear your search." }}
          exportCsv={{
            filename: "clubs.csv",
            header: ["Club", "Venue", "Genre", "Cadence", "Active", "Capacity", "This month"],
            row: (c) => [c.name, c.location, c.genre, c.cadence, counts.active(c), c.memberCapacity ?? "", selOf(c)?.title ?? "Not yet picked"],
          }}
          footerLabel={(n, total) => `${n} of ${total} clubs`}
          footerRight="Clubs · Members standalone from Customers"
        />
      )}
    </div>
  );
}
