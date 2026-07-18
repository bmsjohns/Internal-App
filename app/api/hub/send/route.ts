import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getHubDataSource } from "@/lib/data/hub";
import { getClubsDataSource } from "@/lib/data/clubs";
import { batchCsv, batchPending } from "@/lib/hub";
import { LOCATIONS } from "@/lib/types";

// Flow B send (C3) — RESTRICTED to hub:send. Both fulfilment paths land
// here: "Email" stores the exact reviewed body (the client opens the user's
// mail app with it); "CSV" returns the file content and the download itself
// marks the batch sent. Sending is refused outright without the matching
// account number (C6) — never a malformed order.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "hub:send")) {
    return NextResponse.json(
      { error: "Sending orders needs the hub:send permission — ask a manager to send this batch" },
      { status: 403 }
    );
  }
  const body = await req.json();
  const { publisherId, account, method } = body ?? {};
  if (!publisherId || !LOCATIONS.includes(account) || !["Email", "CSV"].includes(method)) {
    return NextResponse.json({ error: "publisherId, account and method (Email/CSV) are required" }, { status: 400 });
  }
  const hub = getHubDataSource();
  const [lines, publishers] = await Promise.all([hub.listLines(), hub.listPublishers()]);
  const batch = batchPending(lines, publishers).find(
    (b) => b.publisherId === publisherId && b.account === account
  );
  if (!batch || batch.lines.length === 0) {
    return NextResponse.json({ error: "This batch is no longer pending" }, { status: 409 });
  }
  if (batch.blocked) {
    return NextResponse.json(
      { error: `No ${account} account number on file for this publisher — add it in Publishers before sending` },
      { status: 422 }
    );
  }
  const csv = batchCsv(batch);
  // Email path: the copy stored is EXACTLY what the sender reviewed (C3).
  const sentCopy = method === "Email" ? String(body.emailBody ?? "") : csv;
  if (method === "Email" && !sentCopy.trim()) {
    return NextResponse.json({ error: "Email body is empty" }, { status: 400 });
  }
  const sent = await hub.markSent(publisherId, account, method, user.name, sentCopy);
  // Mirror into the live Book Orders status column ("Publisher Contacted")
  // so the team's existing Airtable views stay truthful.
  const clubs = getClubsDataSource();
  for (const line of sent) {
    if (line.source !== "bookclub" || !line.sourceLink) continue;
    try {
      await clubs.updateSelectionOrderStatus(line.sourceLink, "sent");
    } catch (e) {
      console.error(`Send status write-back failed for selection ${line.sourceLink}`, e);
    }
  }
  return NextResponse.json({ sent: sent.length, csv: method === "CSV" ? csv : undefined });
}
