import { NextRequest, NextResponse } from "next/server";
import { normaliseStripeEvent, verifyWebhookSignature } from "@/lib/stripe";
import { getClubsDataSource } from "@/lib/data/clubs";

// Stripe webhook (spec B2): payment succeeded/failed + subscription
// updated/cancelled sync straight into Club Memberships, so a failed card
// surfaces on the Failed Payments view without anyone checking Stripe.
//
// Setup (Ben): Stripe dashboard → Webhooks → add endpoint
//   https://<app-domain>/api/stripe/webhook
// with events invoice.payment_failed, invoice.payment_succeeded,
// customer.subscription.updated, customer.subscription.deleted; put the
// signing secret in STRIPE_WEBHOOK_SECRET.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  if (!(await verifyWebhookSignature(payload, sig, secret))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  let evt: unknown;
  try {
    evt = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  const normalised = normaliseStripeEvent(evt);
  // Events we don't act on still 200 so Stripe doesn't retry them forever.
  if (normalised) await getClubsDataSource().applyStripeEvent(normalised);
  return NextResponse.json({ received: true });
}
