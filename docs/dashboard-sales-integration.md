# Management Dashboard — Sales data wiring (later phase)

The dashboard (`/dashboard`, `dashboard.view` permission) is live against
existing module seams for tiles, Operational and Trend. The **Sales section
runs on the deterministic mock** (`lib/data/sales-mock.ts`) and is labelled
"Sample data" in the UI until the real integrations land. This doc records
what the live phase needs, answering the spec's open questions.

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

## Where the code goes

`lib/data/sales.ts` is the switch (same pattern as the briefing's
Deputy/Slack overlays): implement `SalesDataSource` in
`lib/data/sales-square-stripe.ts`, flip `isSalesLive()` to check the env
vars, and the API route + page need no changes. Keep the mock as the
fallback when env vars are missing — the UI's "Sample data" chip keys off
`isSalesLive()`.
