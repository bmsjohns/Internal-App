import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getClubsDataSource } from "@/lib/data/clubs";
import { getHubDataSource } from "@/lib/data/hub";

// Book Selection entry (spec B4): one book per club per month. Quantity is
// the EXACT active-member count (+1 host copy when ticked) — computed here,
// not client-supplied. Saving (re)stages the draft in the Ordering Hub and
// links the two records; the hub line owns order status from then on.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { clubId, month, title, isbn } = body ?? {};
  if (!clubId || !month || !title?.trim()) {
    return NextResponse.json({ error: "clubId, month and title are required" }, { status: 400 });
  }
  const clubsSrc = getClubsDataSource();
  const hub = getHubDataSource();
  const club = await clubsSrc.getClub(clubId);
  if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });
  if (!can(user, "clubs.manage", club.location)) return NextResponse.json({ error: "No club management access at this location" }, { status: 403 });

  const memberships = await clubsSrc.listMemberships();
  const activeCount = memberships.filter((s) => s.clubId === clubId && s.status === "active").length;
  const hostCopy = !!body.hostCopy;
  const quantity = activeCount + (hostCopy ? 1 : 0);

  const selection = await clubsSrc.saveSelection(
    {
      clubId,
      month,
      title: String(title).trim(),
      isbn: String(isbn ?? "").trim(),
      publisherId: body.publisherId ?? null,
      imprint: String(body.imprint ?? ""),
      rrp: body.rrp != null ? Number(body.rrp) : null,
      hostCopy,
      quantity,
    },
    user.name
  );

  const line = await hub.upsertSourceDraft(
    {
      title: selection.title,
      isbn: selection.isbn,
      quantity,
      publisherId: selection.publisherId,
      imprint: selection.imprint,
      rrp: selection.rrp,
      source: "bookclub",
      sourceLabel: `Book Club — ${club.name}`,
      sourceLink: selection.id,
      account: club.location, // pre-filled from the club; still confirmed at staging
      orderType: "bookclub",
      draftKey: `bc-${clubId}`,
    },
    user.name
  );
  if (selection.hubLineId !== line.id) await clubsSrc.setSelectionHubLine(selection.id, line.id);

  return NextResponse.json({ selection: { ...selection, hubLineId: line.id }, activeCount, quantity });
}
