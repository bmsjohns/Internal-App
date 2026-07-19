import type { VenueKey } from "@/lib/config";
import { londonDayRange } from "./sales-square";

// Stripe adapter for the sales ledger. There are THREE Stripe sub-accounts
// under the main account (all Simply Books today), and a restricted key
// only sees its own account — so the env var per venue takes a
// comma-separated LIST of read-only restricted keys and the day total is
// the sum across them:
//   STRIPE_SALES_KEYS_SIMPLY=rk_live_a,rk_live_b,rk_live_c
//   STRIPE_SALES_KEYS_PROLOGUE=            (empty until Prologue gets Stripe)
// Keys need read access to Charges. Gross successful charges, refunds
// ignored in v1 (same stance as Square, documented).

const STRIPE_BASE = "https://api.stripe.com/v1";

export function stripeSalesKeys(venue: VenueKey): string[] {
  const raw = venue === "simply" ? process.env.STRIPE_SALES_KEYS_SIMPLY : process.env.STRIPE_SALES_KEYS_PROLOGUE;
  return (raw ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export function stripeSalesConfigured(): boolean {
  return stripeSalesKeys("simply").length > 0 || stripeSalesKeys("prologue").length > 0;
}

async function stripeList(key: string, path: string): Promise<any> {
  const res = await fetch(`${STRIPE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Gross successful charge volume for one sub-account key on one London day. */
async function accountDayTotal(key: string, gte: number, lt: number): Promise<number> {
  let total = 0;
  let startingAfter: string | undefined;
  for (;;) {
    const params = new URLSearchParams({ limit: "100", "created[gte]": String(gte), "created[lt]": String(lt) });
    if (startingAfter) params.set("starting_after", startingAfter);
    const data = await stripeList(key, `/charges?${params}`);
    for (const charge of data.data ?? []) {
      if (charge.paid && charge.status === "succeeded") total += Number(charge.amount ?? 0) / 100;
    }
    if (!data.has_more || !data.data?.length) return total;
    startingAfter = data.data[data.data.length - 1].id;
  }
}

/** Combined day total across the venue's sub-account keys. null = venue has
 *  no Stripe configured (renders "Not connected", not £0). */
export async function fetchStripeDay(venue: VenueKey, dateIso: string): Promise<number | null> {
  const keys = stripeSalesKeys(venue);
  if (keys.length === 0) return null;
  const { startAt, endAt } = londonDayRange(dateIso);
  const gte = Math.floor(new Date(startAt).getTime() / 1000);
  const lt = Math.floor(new Date(endAt).getTime() / 1000);
  const totals = await Promise.all(keys.map((key) => accountDayTotal(key, gte, lt)));
  return totals.reduce((s, t) => s + t, 0);
}
