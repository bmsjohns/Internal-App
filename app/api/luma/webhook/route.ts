import { NextRequest, NextResponse } from "next/server";
import { verifyLumaWebhook } from "@/lib/luma";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("webhook-signature") ?? "";
  if (!verifyLumaWebhook(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Backstage deliberately does not persist Luma guest payloads. The UI uses
  // read-through aggregate sync, so acknowledging a valid webhook is enough
  // to support delivery testing without introducing a second guest database.
  return new NextResponse(null, { status: 204 });
}
