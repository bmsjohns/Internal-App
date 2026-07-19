"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useVenue } from "@/components/VenueContext";
import DataTable, { type FilterGroup } from "@/components/DataTable";
import { useClubsData } from "@/components/clubs/data";
import { MemberAvatar, ModuleHeader, Tag, useAccent } from "@/components/clubs/ui";
import { PAY_STATUS } from "@/lib/clubs";

// Global member search (spec B3): every member across all clubs, searchable
// by name / email / phone with partial matches. Members are STANDALONE from
// Customers (B1) — deliberately no linking in this phase.
export default function MembersPage() {
  const router = useRouter();
  const { venue } = useVenue();
  const { accent, accentSoft } = useAccent();
  const { data, error } = useClubsData();

  const rows = useMemo(() => {
    if (!data) return [];
    const byMember = new Map<string, typeof data.memberships>();
    for (const s of data.memberships) {
      byMember.set(s.memberId, [...(byMember.get(s.memberId) ?? []), s]);
    }
    const clubOf = new Map(data.clubs.map((c) => [c.id, c]));
    return data.members
      .map((m) => {
        const subs = byMember.get(m.id) ?? [];
        return {
          m,
          subs,
          clubNames: subs.map((s) => clubOf.get(s.clubId)?.name ?? "").filter(Boolean),
          activeCount: subs.filter((s) => s.status === "active").length,
          anyFail: subs.some((s) => s.status !== "cancelled" && s.payStatus !== "ok"),
          anyPaused: subs.some((s) => s.status === "paused"),
          locations: new Set(subs.map((s) => clubOf.get(s.clubId)?.location)),
        };
      })
      .filter(
        (r) => venue === "all" || r.locations.has(venue === "simply" ? "Simply Books" : "Prologue")
      );
  }, [data, venue]);

  type Row = (typeof rows)[number];

  const filterGroups: FilterGroup<Row>[] = [
    {
      id: "standing",
      label: "Standing",
      chips: [
        { key: "failed", label: "Payment issues", count: rows.filter((r) => r.anyFail).length, predicate: (r) => r.anyFail },
        { key: "paused", label: "Has paused sub", predicate: (r) => r.anyPaused },
        { key: "multi", label: "In 2+ clubs", predicate: (r) => r.subs.length >= 2 },
      ],
    },
  ];

  const teal = venue === "simply";

  return (
    <div className="flex min-h-screen flex-col">
      <ModuleHeader
        eyebrow="Book clubs"
        title="Members"
        subtitle="Every member across all clubs. Search by name, email or phone — partial matches welcome. Standalone from Customers."
      />
      {error ? (
        <p className="px-8 py-10 text-sm font-semibold text-rust">{error}</p>
      ) : !data ? (
        <p className="px-8 py-10 text-sm text-stone">Loading…</p>
      ) : (
        <DataTable
          rows={rows}
          rowKey={(r) => r.m.id}
          onRowClick={(r) => router.push(`/members/${r.m.id}`)}
          accent={accent}
          accentSoft={accentSoft}
          storageKey="members"
          searchPlaceholder="Search name, email or phone"
          searchText={(r) => `${r.m.name} ${r.m.email} ${r.m.phone} ${r.clubNames.join(" ")}`}
          filterGroups={filterGroups}
          defaultSort={{ key: "name", dir: "asc" }}
          cardAccent={(r) => (r.anyFail ? "#C4462F" : "#8C857C")}
          columns={[
            {
              key: "name",
              label: "Member",
              sortValue: (r) => r.m.name,
              render: (r) => (
                <div className="flex items-center gap-2.5">
                  <MemberAvatar name={r.m.name} teal={teal} />
                  <div>
                    <div className="font-semibold">{r.m.name}</div>
                    <div className="text-xs text-stone">{r.m.email}</div>
                  </div>
                </div>
              ),
            },
            {
              key: "phone",
              label: "Phone",
              sortable: false,
              tdClass: "tabular-nums text-charcoal",
              render: (r) => r.m.phone || "—",
            },
            {
              key: "clubs",
              label: "Clubs",
              sortValue: (r) => r.subs.length,
              render: (r) => <span className="text-[13px] text-charcoal">{r.clubNames.join(", ") || "—"}</span>,
            },
            {
              key: "active",
              label: "Active",
              align: "center",
              sortValue: (r) => r.activeCount,
              render: (r) => <span className="font-semibold tabular-nums">{r.activeCount}</span>,
            },
            {
              key: "standing",
              label: "Standing",
              sortValue: (r) => (r.anyFail ? 0 : 1),
              render: (r) =>
                r.anyFail ? <Tag {...PAY_STATUS.failed} /> : <span className="text-xs font-semibold text-[#2E6B4F]">Good standing</span>,
            },
          ]}
          card={(r) => (
            <div>
              <div className="mb-1.5 flex items-center gap-2.5">
                <MemberAvatar name={r.m.name} teal={teal} />
                <div>
                  <div className="font-semibold">{r.m.name}</div>
                  <div className="text-xs text-stone">
                    {r.m.email} · {r.m.phone}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-charcoal">{r.clubNames.join(", ") || "—"}</span>
                {r.anyFail && <Tag {...PAY_STATUS.failed} />}
              </div>
            </div>
          )}
          empty={{ title: "No members match.", body: "Try a broader search or clear the filters." }}
          exportCsv={{
            filename: "members.csv",
            header: ["Name", "Email", "Phone", "Clubs", "Active subs", "Standing"],
            row: (r) => [r.m.name, r.m.email, r.m.phone, r.clubNames.join("; "), r.activeCount, r.anyFail ? "Payment issue" : "Good"],
          }}
          footerLabel={(n, total) => `${n} of ${total} members`}
          footerRight="Members · standalone from Customers"
        />
      )}
    </div>
  );
}
