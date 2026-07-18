// Thin Stripe REST client (no SDK dependency — same raw-fetch approach as
// the Deputy/Slack adapters). Used ONLY by the airtable clubs data source;
// mock mode never touches Stripe. Requires STRIPE_SECRET_KEY.
//
// ⚠️ Written but unverified against a live Stripe account — needs Ben's
// restricted API key (read+write on Customers/Subscriptions/Invoices) and a
// webhook endpoint secret before first use. See README §Book Clubs.

const API = "https://api.stripe.com/v1";

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

async function stripe(path: string, init?: { method?: string; form?: Record<string, string> }): Promise<any> {
  const res = await fetch(`${API}/${path}`, {
    method: init?.method ?? (init?.form ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: init?.form ? new URLSearchParams(init.form).toString() : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stripe ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

export async function getSubscription(subId: string): Promise<any> {
  return stripe(`subscriptions/${subId}`);
}

/** Cancel — immediate, or at period end (B2 offers both at cancel time). */
export async function cancelSubscription(subId: string, when: "now" | "period_end"): Promise<void> {
  if (when === "now") await stripe(`subscriptions/${subId}`, { method: "DELETE" });
  else await stripe(`subscriptions/${subId}`, { form: { cancel_at_period_end: "true" } });
}

/** Stripe's native pause: keep the sub, void invoices while paused. */
export async function pauseSubscription(subId: string, resumesAt?: string): Promise<void> {
  const form: Record<string, string> = { "pause_collection[behavior]": "void" };
  if (resumesAt) form["pause_collection[resumes_at]"] = String(Math.floor(new Date(resumesAt).getTime() / 1000));
  await stripe(`subscriptions/${subId}`, { form });
}

export async function resumeSubscription(subId: string): Promise<void> {
  await stripe(`subscriptions/${subId}`, { form: { "pause_collection": "" } });
}

/** Move flow (B2): cancel old sub, create the Club B one on the same
 *  customer. Returns the new subscription id. */
export async function moveSubscription(
  oldSubId: string,
  customerId: string,
  targetPriceId: string
): Promise<string> {
  await stripe(`subscriptions/${oldSubId}`, { method: "DELETE" });
  const created = await stripe("subscriptions", {
    form: { customer: customerId, "items[0][price]": targetPriceId },
  });
  return created.id as string;
}

export async function listInvoices(customerId: string): Promise<any[]> {
  const data = await stripe(`invoices?customer=${encodeURIComponent(customerId)}&limit=24`);
  return data.data ?? [];
}

// ---------------------------------------------------------------------------
// Webhook verification (B2: live sync, not read-on-demand). Manual HMAC so
// we skip the SDK; algorithm per Stripe's docs (t=timestamp,v1=signature).
// ---------------------------------------------------------------------------

export async function verifyWebhookSignature(
  payload: string,
  sigHeader: string,
  secret: string,
  toleranceSec = 300
): Promise<boolean> {
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => kv.split("=") as [string, string])
  );
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
  const given = parts.v1 ?? "";
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

/** Normalise the Stripe events we act on into the seam's shape. */
export function normaliseStripeEvent(evt: any): {
  type: string;
  subscriptionId: string;
  payStatus?: "ok" | "failed" | "past_due";
  status?: "active" | "paused" | "cancelled";
  periodEnd?: string;
} | null {
  const type: string = evt?.type ?? "";
  const obj = evt?.data?.object ?? {};
  if (type === "invoice.payment_failed" || type === "invoice.payment_succeeded" || type === "invoice.paid") {
    const subscriptionId = typeof obj.subscription === "string" ? obj.subscription : obj.subscription?.id;
    if (!subscriptionId) return null;
    return { type, subscriptionId, payStatus: type === "invoice.payment_failed" ? "failed" : "ok" };
  }
  if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
    const subscriptionId = obj.id;
    if (!subscriptionId) return null;
    const status =
      type === "customer.subscription.deleted" || obj.status === "canceled"
        ? "cancelled"
        : obj.pause_collection
          ? "paused"
          : "active";
    const payStatus = obj.status === "past_due" ? "past_due" : undefined;
    const periodEnd = obj.current_period_end
      ? new Date(obj.current_period_end * 1000).toISOString().slice(0, 10)
      : undefined;
    return { type, subscriptionId, status, payStatus, periodEnd };
  }
  return null;
}
