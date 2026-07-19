# Management Dashboard — Sales data wiring

**Status (19 Jul 2026): live path BUILT, awaiting keys.** The adapters,
15-minute sync and rollup table all exist and ship dark — the dashboard
shows the deterministic mock (labelled "Sample data") until the env vars
below are set, then flips to live with no code change. Like the Deputy and
Slack overlays, the Square/Stripe code is **written but unverified against
the real APIs** until Ben provisions keys — expect a shakedown session
(category names, location matching) on first connect.

## How live works (15-minute freshness)

- `vercel.json` cron hits `/api/dashboard/sync` every 15 minutes (route is
  in PUBLIC_ROUTES and authenticates via `CRON_SECRET` bearer — the Stripe-
  webhook Clerk lesson). It fetches **today + yesterday** per venue from
  Square/Stripe (yesterday catches late settles) and upserts one row per
  Date × Venue into the **"Sales Days"** table in the Backstage base
  (`tblu9Uw9097fZsxQK`, created 19 Jul), backfilling up to 30 older missing
  days per run until the 70-day window is complete.
- `getSales()` **self-heals**: if the last sync is older than 15 minutes
  (cron missing or paused, local dev), it syncs inline before reading. So
  the cron is belt-and-braces for days nobody opens the dashboard — the
  15-minute contract holds either way.
- Both sources reduce to the same per-day ledger and share ALL period/delta
  maths (`lib/data/sales-shared.ts`), so mock and live can't disagree about
  what "week to date" means.
- v1 measures **gross successful takings**; refunds/disputes are ignored on
  both channels (flagged — revisit if Ben wants net).

## Issues accepted with the 15-minute cadence

- **Vercel plan**: `*/15` cron granularity needs a Pro team plan (Hobby
  crons are daily-only). The backstage project is on a team — confirm it's
  Pro; if not, the self-heal path alone still delivers ≤15-min freshness
  for anyone actually looking, and the cron just runs less often.
- "Today" figures can additionally lag by Square/Stripe settlement timing —
  the header's "Synced HH.MM" chip is the honest timestamp.
- Airtable write volume is trivial (≤4 rows per run, 5 rps limit intact).

## Answers to the spec's open questions

1. **Does Square return revenue split by category/location?** Yes — Square's
   Orders/Payments APIs carry the location id on every payment, and catalog
   categories cover the retail/café/bar/events split Ben already maintains.
   A live adapter maps, it does not tag. Confirm the category names on the
   Square account before wiring (`retail`, `café`, `bar`, `events` assumed
   in `lib/data/sales-mock.ts` CATEGORIES).
2. **Blend live on each load or aggregate into a shared table?** Pull live
   with a short server-side cache (10 min) for Day/Week/Month-to-date, and
   persist a **daily rollup row per venue × channel** (a small "Sales Days"
   Airtable table or similar) written once a night. The 28-day trend chart
   and future month-vs-month history read the rollup; the top matrix stays
   near-live. This keeps the dashboard honest mid-day without hammering
   either API.
3. **Quick-look tile sources** — all live already, no new endpoints:
   returns to pick = Returns `status=approved`; orders to make =
   needs-ordering backlog (overdue after `ORDERS_OVERDUE_DAYS` in
   `lib/dashboard.ts`, TBC with Ben); failed payments = memberships with
   `payStatus != ok`; unsent drafts = hub `state=draft` valued at the
   negotiated rate; events this week = next 7 days with Luma pace; pitches
   to decide = pitching stage `to-review`.
4. **Trend caching?** Query-on-demand for now — every input list is already
   behind its module seam's 30s cache and the aggregation is one pass (see
   the note at the bottom of `lib/dashboard.ts`). Revisit when trend cards
   need true history (member churn, sales week-on-week), which arrives with
   the rollup table in (2).

## Keys Ben needs to provision

- **Square**: one access token (Square splits by location server-side).
  Scopes: `ORDERS_READ`, `PAYMENTS_READ`, `MERCHANT_PROFILE_READ`.
- **Stripe**: one **restricted key per sub-account** — there are three under
  the main account, and a key only sees its own account's charges. Read-only
  scopes on Charges/Balance transactions are enough. All three are Simply
  Books today; Prologue Stripe doesn't exist yet and the seam models that
  (`stripe: null` → "Not connected" in the matrix).

## Where the code lives

- `lib/data/sales.ts` — the switch (`isSalesLive()` = any env var present).
- `lib/data/sales-shared.ts` — ledger → report maths, shared mock/live.
- `lib/data/sales-square.ts` — locations by name, day totals + category
  buckets via Orders + Catalog (category names map via keywords, override
  with `SQUARE_CATEGORY_MAP` once real names are confirmed).
- `lib/data/sales-stripe.ts` — gross charges per restricted key, summed
  per venue.
- `lib/data/sales-airtable.ts` — "Sales Days" upsert/read (DATETIME_FORMAT
  date filters, the known Airtable gotcha).
- `lib/data/sales-live.ts` — sync orchestration + read path.
- `app/api/dashboard/sync/route.ts` + `vercel.json` — the 15-minute cron.

Partial configuration is honest, never blended: Square-only shows Stripe as
"Not connected" (not mock numbers), and vice versa.

## Open items for Ben

1. Provision the keys in Vercel env: `SQUARE_ACCESS_TOKEN`,
   `STRIPE_SALES_KEYS_SIMPLY` (three keys, comma-separated), `CRON_SECRET`
   (any random string).
2. Confirm the two shops share ONE Square account (two locations). If they
   are separate Square accounts the adapter needs a second token — small
   change, flag it.
3. Send over the Square category names so `SQUARE_CATEGORY_MAP` can replace
   the keyword guesses.
4. Confirm gross (not net-of-refunds) is the number SLT wants on this page.
