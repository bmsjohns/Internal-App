# Book Clubs + Ordering Hub — live wiring (updated 19 Jul 2026)

*Supersedes the original greenfield plan in this file. After Ben pointed at
the live **"Book Clubs" Airtable base** (`app9iXkRaEsUR5S5E`, in daily use
since Oct 2024, Stripe-synced), the app was remapped onto it instead of
creating parallel tables. The only new tables live in the **Backstage** base.
A full untouched duplicate, "Book Clubs (Copy)" (`app8vxmMUKhiUjhdy`),
predates all of this and serves as the rollback reference.*

## 1 · Schema changes APPLIED 19 Jul 2026 (all additive — no data touched)

**Backstage base** (`appW144rQmoJpbxQS`) — new tables:

- **Hub Lines** — the ONE central ordering table across all sources (Ben's
  decision: sources keep their own records — Book Orders, future
  Events/Schools tables — and tie in here via `Source` + `Source Link`).
  Fields: Title · ISBN · Quantity · Publisher ID + Publisher Name
  (cross-base, stored as text) · Imprint · RRP £ · Source (Book
  Club/Events/Schools/Customer) · Source Label · Source Link · Account
  (Simply Books/Prologue, no default) · Order Type · State
  (Draft/Pending/Ordered/Arrived/Deleted) · Draft Key · Created/Sent/Arrived
  At · Sent By/Method/Copy · Log.
- **Restock** — Title · ISBN · Quantity · Location · By · Supplier ·
  Created At · Handled At · Handled By.

**Book Clubs base** (live) — new fields only:

| Table | Field | Notes |
|---|---|---|
| Book Clubs | `Location` (single select SB/PR) | **Blank = Simply Books** (every club predates Prologue) — the app treats it so; only new Prologue clubs need setting. |
| Publishers | `Prologue Account No` | Existing `Account Number` = the Simply Books account. Send is blocked while the relevant one is missing. |
| Publishers | `Events Discount` (percent) | Blank falls back to Standard Discount Terms (base). Replaces the leftover "Schools/Event Discouny" field → **Ben can delete that one**. |
| Book Orders | `Hub Line ID` | Links a monthly pick to its Hub Lines record; the hub writes Status back here (sent → "Publisher Contacted", arrived → "Received"). |
| Members | `Backstage Log` | Audit trail for app actions (cancel/pause/resume/move + webhook), `ISO\|name\|action`. The Stripe sync should leave it alone. |

## 2 · How the app maps the live base

- **Book Clubs** → clubs. Cadence renders from Week/Day/Time ("Week 3 -
  Thursday - 7pm" → "3rd Thursday · 7pm"); a monthly pick's "Date Required
  For" is set to the club's session date (the Nth weekday of that month).
  The base's default Todo/In-progress/Done Status is ignored.
- **Members** → memberships, one row per **subscription** (it's a Stripe
  sync). People are derived by grouping on Customer ID — no person table
  exists yet ("could be improved/rebuilt" — future work, possibly when the
  sync is rebuilt). Member phone/address/card aren't held; notes read from
  Customer Description (read-only in the app while the sync owns the rows).
- **Book Orders** → Book Selections. Existing 561-row history reads
  straight into selection history; new picks create rows with Status "To
  Order" and stage a hub draft.
- **Publishers** → hub reference data. Discounts are stored as fractions
  (0.53) and converted to % in-app; Standard Discount Terms = the
  restock/base rate; Imprints parse from the comma-separated text (quoted
  names like "Little, Brown" handled). Only ~6 publishers have rates/account
  data — worth a fill-in pass, the Publishers screen makes it easy.
- **Payment-link model**: clubs don't hold a Stripe price id — members join
  via per-club payment links. The move-between-clubs flow derives the target
  club's price from an existing active member's Plan; a club with no members
  yet can't be moved into via the app (clear error, do it in Stripe).
- The team's manual "adjust number of payments left when someone leaves"
  practice stays in Stripe for now — the app's cancel offers
  immediate/period-end, and anything subtler is linked out.

## 3 · Stripe setup (Ben — in progress)

1. Restricted API key — Customers, Subscriptions, Invoices, Products/Prices.
   **Read-only first** (payment history + failed payments work); upgrade to
   write to enable cancel/pause/resume/move. → `STRIPE_SECRET_KEY` in Vercel.
2. Webhook: `https://backstage.simplybooks.co.uk/api/stripe/webhook`, events
   `invoice.payment_failed`, `invoice.payment_succeeded`,
   `customer.subscription.updated`, `customer.subscription.deleted` →
   signing secret in `STRIPE_WEBHOOK_SECRET`.
   The webhook updates the same Members rows the existing sync maintains
   (same values, faster) — it doesn't compete with it.
3. One account or two? If Prologue gets its own Stripe account this needs a
   second key + webhook (flag when it happens).

## 4 · Remaining rollout steps

1. **Token access**: the app's `AIRTABLE_API_KEY` needs the **Book Clubs
   base added to its access list** (it already sees Backstage). Until then,
   production clubs/hub screens show a clear "base not reachable" error.
2. Deploy with `DATA_SOURCE=airtable` (clubs/hub follow the same switch).
3. First-run checks: clubs list totals match the base (42), a member search
   for a known name, one real monthly pick end-to-end.
4. Data-quality tidy-up for Ben, at leisure (app is defensive about all of
   it): Book Orders Status has both "Isuue"/"Issue" + a stray option named
   "9781398546165"; some ISBNs carry junk characters (cleaned on read);
   trailing spaces in club names (trimmed on read); "Schools/Event Discouny"
   deletable.

## 5 · Open follow-ups

- **Sessions**: Ben — sessions are the unit a book and its attendees tie to.
  v1 anchors picks to the computed session date; a proper Sessions link
  (attendance, per-session membership) is the natural Phase 2, ideally
  alongside the Members-sync rebuild.
- **Members sync rebuild**: current sync is subscription-rows-only. A
  rebuilt sync (or the webhook taking over fully) could add a real person
  table, card status and pause visibility.
- Language classes / writing groups: Book Clubs's "Book Club Type"
  (Adult/Kids/School) is audience, not the Regular-Events supertype — when
  classes/groups arrive, decide whether they're rows here or a sibling
  table.
