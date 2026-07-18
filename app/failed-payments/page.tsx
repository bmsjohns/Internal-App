"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { PAY_STATUS, money } from "@/lib/clubs";
import { useVenue } from "@/components/VenueContext";
import DataTable from "@/components/DataTable";
import { useClubsData } from "@/components/clubs/data";
import { MemberAvatar, ModuleHeader, Tag, useAccent } from "@/components/clubs/ui";

// Failed Payments (spec B2/B3): everyone currently failed or past-due across
// all clubs, checkable at a glance — its own nav item, kept live by Stripe
// webhooks, and flagged on the Daily Briefing.
export default function FailedPaymentsPage() {
  const router = useRouter();
  const { venue } = useVenue();
  const { accent, accentSoft } = useAccent();
  const { data, error } = useClubsData();

  const rows = useMemo(() => {
    if (!data) return [];
    const memberOf = new Map(data.members.map((m) => [m.id, m]));
    const clubOf = new Map(data.clubs.map((c) => [c.id, c]));
    return data.memberships
      .filter((s) => s.status !== "cancelled" && s.payStatus !== "ok")
      .map((s) => ({ s, m: memberOf.get(s.memberId), c: clubOf.get(s.clubId) }))
      .filter((r) => !!r.m && !!r.c)
      .filter((r) => venue === "all" || r.c!.location === (venue === "simply" ? "Simply Books" : "Prologue"));
  }, [data, venue]);

  type Row = (typeof rows)[number];

  return (
    <div className="flex min-h-screen flex-col">
      <ModuleHeader
        eyebrow="Book clubs · needs attention"
        title="Failed payments"
        subtitle="Everyone currently failed or past-due, across all clubs. Kept live by Stripe webhooks — also flagged on the Daily Briefing."
      />
      {error ? (
        <p className="px-8 py-10 text-sm font-semibold text-rust">{error}</p>
      ) : !data ? (
        <p className="px-8 py-10 text-sm text-stone">Loading…</p>
      ) : (
        <DataTable<Row>
          rows={rows}
          rowKey={(r) => r.s.id}
          onRowClick={(r) => router.push(`/members/${r.m!.id}`)}
          accent={accent}
          accentSoft={accentSoft}
          storageKey="failed-payments"
          searchPlaceholder="Search member or club"
          searchText={(r) => `${r.m!.name} ${r.m!.email} ${r.c!.name}`}
          defaultSort={{ key: "member", dir: "asc" }}
          cardAccent={() => "#C4462F"}
          columns={[
            {
              key: "member",
              label: "Member",
              sortValue: (r) => r.m!.name,
              render: (r) => (
                <div className="flex items-center gap-2.5">
                  <MemberAvatar name={r.m!.name} size={32} />
                  <div>
                    <div className="font-semibold">{r.m!.name}</div>
                    <div className="text-xs text-stone">{r.m!.email}</div>
                  </div>
                </div>
              ),
            },
            {
              key: "club",
              label: "Club",
              sortValue: (r) => r.c!.name,
              render: (r) => (
                <div className="text-charcoal">
                  {r.c!.name}
                  <div className="text-[11px] text-stone">{r.c!.location}</div>
                </div>
              ),
            },
            {
              key: "status",
              label: "Status",
              sortValue: (r) => r.s.payStatus,
              render: (r) => <Tag {...PAY_STATUS[r.s.payStatus]} />,
            },
            {
              key: "card",
              label: "Card",
              sortable: false,
              tdClass: "tabular-nums text-charcoal",
              render: (r) => r.s.cardLabel || "—",
            },
            {
              key: "amount",
              label: "Amount",
              align: "right",
              sortValue: (r) => r.s.amount,
              render: (r) => <span className="font-semibold tabular-nums">{money(r.s.amount)}/mo</span>,
            },
          ]}
          card={(r) => (
            <div>
              <div className="mb-1.5 flex items-center gap-2.5">
                <MemberAvatar name={r.m!.name} size={32} />
                <div>
                  <div className="font-semibold">{r.m!.name}</div>
                  <div className="text-xs text-stone">{r.c!.name}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Tag {...PAY_STATUS[r.s.payStatus]} />
                <span className="text-xs tabular-nums text-stone">
                  {r.s.cardLabel} · {money(r.s.amount)}/mo
                </span>
              </div>
            </div>
          )}
          empty={{ title: "All clear.", body: "No failed or past-due payments right now.", image: "/assets/bird-reading.png" }}
          exportCsv={{
            filename: "failed-payments.csv",
            header: ["Member", "Email", "Club", "Status", "Card", "Amount"],
            row: (r) => [r.m!.name, r.m!.email, r.c!.name, r.s.payStatus, r.s.cardLabel, r.s.amount],
          }}
          footerLabel={(n) => `${n} currently failing`}
          footerRight="Stripe webhook · live sync"
        />
      )}
    </div>
  );
}
