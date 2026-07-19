# Backstage — internal ops platform

Internal ops platform for **Simply Books** (Bramhall) and **Prologue Books**
(Weir Mill, Stockport) — formerly "Order Book", renamed **Backstage** now it
spans more than orders. Modules so far: **Daily Briefing** (the landing
page — see §Daily Briefing), **Customer Orders** (V3) and **Events Phases
1–2** (see §Events below). Next.js 15 (App Router) · Clerk · Airtable ·
Tailwind 4, deployed on Vercel.

## Running locally

```bash
npm install
npm run dev
```

`.env.local` ships in mock mode (`DATA_SOURCE=mock`, `DEV_AUTH_BYPASS=1`):
in-memory sample data, no Clerk account, and **zero contact with the live
Airtable base**. `DEV_AUTH_ROLE=staff|manager` switches the dev user's role.
The bypass refuses to activate in production builds.

## ⚠️ Schema migration (needs Ben's sign-off — nothing has been changed)

The live base (`appAlp6BBobAiV0d6`) has **not been touched**. All development
and testing ran against the mock data source. Before pointing the deployed app
at the live base, these schema changes need applying (each is one "add field"
action in Airtable):

| Table  | Field    | Type                                        | Why |
|--------|----------|---------------------------------------------|-----|
| Orders | Location | single select: `Simply Books`, `Prologue`   | The one Ben flagged (V1). After adding it, select-all existing records → set to `Simply Books` (confirmed default for all past orders). |
| Orders | Notes    | long text                                   | Beyond spec (V1): per-order context ("wants it signed", "reprint due"). |
| Orders | Publisher | **single line text** (recommended over single select) | V3 §1. Text rather than select because the app constrains values to the Suppliers list anyway (picker, not free typing), and a select would need a new option added in Airtable every time a supplier is added in Settings — two places to maintain the same list. |
| Orders | Price    | currency (£, 2 dp)                          | V3 §1. |
| Orders | Quantity | number (integer), backfill existing → 1     | V3 §1: one order line can now be several copies. |
| Orders | Status Log | long text                                 | V3 §5 audit trail: one line per status change, `ISO timestamp\|name\|status`. App-maintained; don't hand-edit. |
| **Suppliers** (new table) | Name (primary), Cadence (text), Account Number (text) | — | V3 §3/§4: per-supplier ordering cadence + the shop's account number (printed on the export). |

**Recommendation: add fields to the existing base — do not split by venue.**
A separate base per venue would break the combined queue (two API sources,
two rate limits, cross-base customer duplication) for no gain; a single
`Location` select keeps combined and filtered views trivial and matches how
the team actually works (one team, two tills). Splitting could be revisited
if the venues ever separate operationally.

**Customers table gets no location field.** Customers shop at both venues;
venue is a property of the order, not the person. (Checked against spec §2a.1.)

**Rollout order:** (1) Ben approves this table; (2) duplicate the live base
*with records* in Airtable (workspace → base menu → Duplicate) and apply the
two fields to the duplicate first as a rehearsal; (3) apply to live base and
backfill Location = Simply Books; (4) deploy with `AIRTABLE_HAS_NEW_FIELDS=true`.
Until then, the flag defaults to off (no env var needed) — the app neither
reads nor writes the new fields and treats every record as Simply Books.

### Status field — V2 canonical model (display-only, still no schema change)

The 18 status options overlap (three flavours of "Ordered"; "Not paid"
duplicating the Paid? field). Since V2, the UI works with the design's **7
canonical statuses** (Needs ordering → Ordered → In store → Ready for
collection → Collected, plus Can't get and Cancelled):

- Every raw Airtable value **maps into one** for chips, filters and the
  detail-page timeline (`CANONICAL_STATUSES` in `lib/config.ts`).
- The form's status picker shows the 7 and **writes back an existing
  Airtable option** (`writeAs`), so no schema change or typecast is needed.
  Edits only rewrite Status when the stage actually changed, so legacy
  values like "Ordered - In Basket" aren't silently rewritten.
- The raw value is still shown on the order detail page ("Airtable
  status"), so nothing is hidden.

Consolidating the base itself (deleting the redundant options) remains a
separate migration for Ben to approve — the mapping table in
`lib/config.ts` is the proposal. It matches the V3 spec's suggested set,
plus **Can't get** (the V3 list dropped it, but live data uses it and it's a
real outcome — flagging rather than silently removing).

**Paid? (V3 §2):** the form now offers only Paid / Not Paid and chips
display every legacy value as one of the two ("Paid Online" → Paid, the
stray "Ordered" → Not Paid). The raw value stays visible on the detail
page, so the online-vs-in-store distinction isn't lost yet — whether to
delete "Paid Online" from the base is Ben's call in the same migration.

## V3 — what changed

- **To Order page** (`/to-order`, replaces End-of-day; old URL redirects):
  the outstanding queue with per-row quantity steppers, a supplier picker
  at the point of ordering (with that supplier's cadence shown), and
  one-click "Mark ordered". *Default chosen:* no daily cutoff — it always
  shows everything outstanding (question for Ben below).
- **Settings** (`/settings`): generic settings shell; the only panel today
  is Orders → Suppliers (name, cadence, account number). Gated by a new
  `settings:manage` permission (managers get it by default; grantable
  per-user via Clerk metadata `permissions`). Future modules add their own
  panels to the shell — nothing supplier-specific leaks outside the panel
  component (§10a).
- **Export XLSX** (`/api/export/outstanding`): one worksheet per supplier
  (plus Unassigned), columns Title / ISBN / Quantity / Account number.
- **Status timeline control** on the detail page: click a stage to move
  the order. Stage 2 is a **branch** — Ordered and In store are
  mutually-exclusive alternatives, per Ben's constraint — with Can't get /
  Cancelled as off-path outcomes. Every change is recorded (who + when)
  in the Status Log and shown as history.
- **Order detail**: cover photo from the ISBN (OpenLibrary covers), with a
  visible "double-check the ISBN" warning when nothing resolves; team
  member picker (defaults to the logged-in user, can be set to a
  colleague); price/quantity/supplier facts.
- **Form fixes**: pre-order checkbox now comes *before* the publication
  date it reveals; price + quantity fields; team member + supplier
  selects.
- **Customer profiles** (`/customers/[id]`): contact details + order
  history reusing the shared orders table.
- **Search/lookup**: queue search already matched customer and book names;
  ISBN lookup now passes `country=GB` so Google Books prefers UK titles.
- **Buttons**: primary/secondary/danger now share identical geometry
  (padding, border, type size) — only fill differs.

### V3 defaults awaiting Ben's confirmation

1. **To Order scope** — always the full outstanding queue, no daily
   cutoff/reset. Say the word if the end-of-day ritual should return.
2. **Export scope** — not-yet-ordered only (it's the "send to supplier"
   file). Including ordered-but-not-arrived would need an extra state or
   the Estimated Lead Time field.
3. **Supplier vs publisher** — the spec uses both words; V3 treats them as
   one list (the party you order from, e.g. Gardners *or* Penguin direct),
   stored in the Publisher field and managed in Settings. If "publisher of
   the book" and "supplier you order it via" need to be separate fields,
   that's a schema addition to flag now.
4. **Timeline shape** — currently Needs ordering → (Ordered | In store) →
   Ready for collection → Collected, with Can't get/Cancelled off-path.
   Confirm this matches the real workflow.
5. **"Paid Online"** — keep or collapse (see §Status above).

### Team Member — behavioural change (spec §6, option b)

The 31-option picker (duplicate Matts/Lynseys, lowercase "gemma"/"lar") is
gone. On create, the app stamps the **logged-in user's** first name if it
matches an existing option, else leaves it blank. No new options are ever
created (no typecast writes). Long-term this should become a Clerk-linked
collaborator field; cleaning the existing option list is safe any time since
the app never writes unmatched names.

## Auth (Clerk) — setup for Ben

1. Create a Clerk app (clerk.com, free tier: 10k MAU — the team fits easily).
2. Put `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` in Vercel env.
3. Invite staff from the Clerk dashboard (no self-serve signup, no redeploy).
4. Per user, set **public metadata** in the dashboard:
   - staff: `{ "role": "staff" }` (or leave empty — staff is the default)
   - venue-scoped manager: `{ "role": "manager", "managerLocations": ["Prologue"] }`
   - joint manager: `{ "role": "manager", "managerLocations": "all" }`

If Clerk is not configured, production now fails closed with HTTP 503 for
pages and APIs. `DEV_AUTH_BYPASS=1` is accepted only outside production.

**Conscious deviations to flag (spec §5):** (a) using a managed auth provider
reverses the earlier "no third-party auth" decision — cost stays £0 but adds
one third-party account holding staff emails; (b) roles live in Clerk
`publicMetadata` rather than Clerk Organizations custom roles, because custom
org roles/permissions are a **paid** Clerk add-on and the target cost is
"effectively free". Permissions are still centrally managed in the Clerk
dashboard, and module-specific permission strings (e.g. `events:delete`) can
be added to the same metadata shape when the Events module lands.

## Deployment (Vercel)

GitHub repo → Vercel import → env vars: `DATA_SOURCE=airtable`,
`AIRTABLE_API_KEY` (a scoped PAT: data read/write on both the Orders and
Events bases), the two Clerk keys. That's the whole minimum set —
`AIRTABLE_BASE_ID` and `AIRTABLE_HAS_NEW_FIELDS` both default correctly
(base id to the live Orders base, new-fields to `false`/off, matching the
live base as it stands) and only need setting to override. Enable Events
schema flags only after their documented migrations have been verified; in
particular, see the migration documents before enabling
`EVENTS_AIRTABLE_HAS_PHASE2` or `EVENTS_AIRTABLE_HAS_EVENT_LOCATION`. Works
behind a custom domain later.

> **Licensing note (spec §10):** Vercel Hobby is licensed for
> personal/non-commercial use. A business is nominally meant to be on Pro
> ($20/mo). Flagging, not deciding.

**PWA-lite:** installable via Add to Home Screen (manifest + icons); no
service worker/offline by design.

## Architecture notes for the next module (spec §7–8)

- `lib/data/source.ts` defines the `DataSource` interface; `airtable.ts` and
  `mock.ts` implement it. **Nothing outside `lib/data` touches Airtable.**
  The Postgres migration = one new file + `DATA_SOURCE=postgres`.
- The Events module gets `app/events/` + `lib/data/events.ts` + a tab in
  `components/Nav.tsx` (`MODULES` array). Auth/permissions are shared —
  extend the metadata shape, don't invent a parallel system.
- Airtable rate limit (5 req/s/base) is why Postgres eventually: fine for one
  module + small team, not for several concurrent modules.

## Brand & design (V2)

V2 implements Ben's Claude Design project ("Order Book.dc.html",
claude.ai/design project `4fc6a73a…`): white sidebar shell with an app-level
venue switcher (persisted per device) and module nav with Events/Schools
placeholders, filter chips, a scanner-first entry screen with a "This
session" panel, a read-only order detail page with a progress timeline, and
a venue-grouped end-of-day list. Below `lg` the sidebar collapses to a top
bar.

Tokens in `app/globals.css` follow the design's `colors_and_type.css`
(cream/ink/charcoal/stone + brand reds; Simply Books navy `#2B4C6F`,
Prologue rust `#AD3B28`). The **real brand fonts** ship in `app/fonts/` via
`next/font/local`: New Spirit (display) and Karla (sans) — both supplied by
Ben through the design project. *Licence note:* New Spirit is a commercial
Newlyn face; fine for this internal tool if Ben holds the licence, worth a
check before any public deploy. Pigeon mascot + P-mark assets live in
`public/assets/`.

## Beyond spec (spec §2b — flagged, not silent)

- **ISBN → title/author auto-fill** on scan/Enter (OpenLibrary, Google Books
  fallback; both free/keyless). Supports the "speed of entry" goal: scan,
  glance, save.
- **Orders.Notes field** (see migration table).
- **End-of-day summary groups duplicate ISBNs** into one row with quantity,
  and has a venue toggle + date picker (yesterday's list on a busy morning).
- **Dev/mock data source** — doubles as the safe-sandbox requirement.

## Events module — Phase 1: Pitching

Built from `events-phase1-pitching-spec.md` (16 Jul 2026). The pipeline of
proposed author/book events, before any become confirmed bookings. Separate
Airtable base (`apphUDuZ5u7NCisay`, table `Event Pitching`), so it has its
own data seam: `lib/data/events.ts` (interface `events-source.ts`, Airtable
impl `events-airtable.ts`, mock `events-mock.ts`) — same `DATA_SOURCE`
switch, same "mock in dev, live base never touched" rule.

**Screens:** `/pitching` — kanban board (columns = canonical stages) and a
sortable list view as a toggle over the same data; a single combined
detail/edit screen; a quick-create New pitch screen. Layout follows the
Claude Design file ("Order Book.dc.html" in project
`4fc6a73a-3e27-4c9f-bdc0-4ee641e7d062`): stage-coloured column accents with
hint lines, cream cards (priority pill, display-face title, stars + lead),
Pipeline/People/Venues rails on the editor, bird-banner quick-create. The
design mocked a proposed 5-status model and a pre-Phase-0 publisher flag —
visuals were adopted; the data model follows the spec (real statuses,
imprint-primary). Cards move by **drag-and-drop** (per the design); on touch,
the stage select on the editor's Pipeline panel does the same write.

**Access** is deliberately narrow (spec §1): `pitching:view` / `pitching:edit`
/ `pitching:delete` are granted per-person via Clerk `publicMetadata`
`permissions`, NOT by role. Nobody gets them by default. ⚠️ Override
semantics: an explicit `permissions` list replaces role defaults, so a
manager in the pitching group needs
`{ "permissions": ["settings:manage", "pitching:view", "pitching:edit", "pitching:delete"] }`.
**Ben: name the group** and set that in the Clerk dashboard per user.

**Status model** (lib/pitching.ts): the live table's 13 Status options fold
into 8 board columns; writes only ever use existing Airtable option strings
(`writeAs`), raw value stays visible on the detail page. Judgement calls to
confirm:
- "Opportunity from London" (81 of 123 records!) is a *source*, not a stage → shown as **Wishlist**
- "Doing Events" → shown as **Won**
- "Identified" → **Wishlist**; "To Pitch - Elinor Creating" and "Pitch To Review" → **Preparing pitch**

A real clean-up of the option list itself (like the Orders status migration)
is a schema change for Ben to approve separately.

**Publisher/Imprint (Phase 0):** the app writes Imprint only; Publisher
displays read-only, derived from the imprint (falling back to the legacy
direct link on old records), and the data layer accepts the Publisher field
as either a link (pre-migration) or a lookup (post-migration). The full
schema-fix plan — verified live-base analysis, Ben's decision gates, and the
sandbox-first runbook — is in
[docs/events-phase0-migration.md](docs/events-phase0-migration.md).
**Nothing in the live base has been changed**; the migration waits on Ben's
D1–D5 decisions and a duplicated sandbox base shared with the integration.

**Pending schema addition (NOT applied — same sign-off rule as Orders):**
- `Location` single select (`Simply Books` / `Prologue`) on Event Pitching,
  same pattern as Orders. Until it exists, leave `EVENTS_AIRTABLE_HAS_LOCATION`
  unset and the field is neither read nor written (the "Shop" control in the
  UI works in mock mode). Proposed config: singleSelect, options exactly
  `Simply Books`, `Prologue`, no default.

**Env:** reuses `AIRTABLE_API_KEY` (token must be granted access to the
Events base too, scopes `data.records:read/write`); optional
`EVENTS_AIRTABLE_BASE_ID` override; `EVENTS_AIRTABLE_HAS_LOCATION=true` once
the Location field exists.

**Known limits (by design, Phase 1):** venues are select-only — a missing
venue is added in Airtable directly until Phase 2's venue management; pitch
decks upload via Airtable's content API (5MB/file cap); the Lead picker is a
hardcoded collaborator list in `lib/pitching.ts` (Ben/Elinor/Charlotte —
Airtable doesn't expose base collaborators over REST); `Proposed Dates` and
`Estimated Audience Size` stay free text (flagged in spec, out of scope);
the table's stray `Minimum order` field isn't surfaced (not in the spec's
field list — flag if wanted).

## Events module — Phase 2: Events, Venues, Hosts

Built from `events-phase2-events-venues-hosts-spec.md` + the running-order
design brief (16 Jul 2026), against the same Claude Design file
("Order Book.dc.html") — with the design's placeholder option lists replaced
by the real ones pulled from the live base (Event Type, Age Group, venue
locations; see `lib/events.ts`).

**Screens:**
- `/events` — list + calendar toggle over the same data; filters for
  status / venue / event type / shop Location, with explicit sorting. Mobile gets stacked cards instead of the table.
- `/events/[id]` — one screen, five sub-tabs (design brief §2): General,
  Show details, **Running order** (time-sequenced plan by Pre/During/Post
  show phase, inline step editing, live "Now / Up next" markers from the
  device clock), **Staffing** (per-event roles defined within each phase,
  people assigned per role, gaps called out, roster cards), Book orders
  (Phase 3 placeholder). Existing events **autosave optimistically**
  (debounced PATCH, Saved/Retry states); `/events/new` accumulates a draft
  and POSTs. "Convert to booking" on a won pitch opens
  `/events/new?fromPitch=<id>` with author/title/ISBN/venue/shop Location and
  publisher/imprint context carried over.
- `/venues`, `/venues/[id]`, `/venues/new` — card grid + CRUD (photo and
  tech-spec attachments read-only from Airtable).
- `/hosts`, `/hosts/[id]`, `/hosts/new` — table + CRUD (Team Contact(s) is
  an Airtable collaborator field → read-only in the app).
- `/events/[id]/print` — the call sheet as an on-brand printable document
  (masthead, facts grid, run of show, team roster); "Download PDF" =
  browser print-to-PDF. Chrome-free route (no sidebar).
- `/callsheet/[id]` — **Live mode**, the day-of call sheet (spec §6):
  standalone phone-first page with the event facts, tap-to-call host,
  live Now/Next banner, run of show, and the whole team's roles. Built for
  poor signal: recent data snapshots are cached per authorized viewer for at
  most 24 hours (never displayed before an auth/network result), and a **service worker**
  (`public/sw.js`) caches the page shell + static assets on the FIRST load
  (the page primes its own URL into the cache), so it keeps working — and
  survives a reload — after connectivity drops. This is the app's one
  deliberate offline surface; nothing else registers the SW.

**Access tiers** (lib/auth.ts) — **confirmed by Ben 16 Jul 2026**: the wider
Events module (`events:view` / `events:edit`) is permission-only, granted
per-person in Clerk like pitching; `callsheet:view` is
granted to **all roles by default** — it opens only the call sheet page,
and only for events the person is staffed on (events-module users can open
any). Staff identity on roles/schedule = Clerk user id (mock slugs in dev),
so "You" highlighting works with no mapping table.

**Schema honesty:** the live Events table has no Status/ISBN/From Pitch
fields and no roles/schedule tables yet. The full migration plan — new
fields, `Event Roles` + `Run of Show` tables (structured records,
deliberately template-ready per spec §6), the confirmed Schools
Session-1/2 → `Event Sessions` restructure, data-quality flags, and the
sandbox-first runbook — is in
[docs/events-phase2-migration.md](docs/events-phase2-migration.md).
**Nothing in the live base has been changed.** Until Ben signs off and
`EVENTS_AIRTABLE_HAS_PHASE2=true` is set, live events read as Confirmed and
the running-order/staffing editors are read-only with a notice (mock mode
is fully editable). `Date and Time` maps to the app's date + time in
**Europe/London** both ways, so 7.30pm stays 7.30pm wherever the server runs.

## Daily Briefing (default landing page)

Built from `daily-briefing-spec.md` + the Claude Design file
**"Daily Briefing.dc.html"** (same design project as V2). Where the design
went beyond the spec — urgent alerts with in-page posting, a celebrations
band, an Overview/Full-day detail toggle, per-venue stat tiles and opening
hours, collapsible wrap-up bands, a Slack new-message banner — the design
was treated as authoritative and built as drawn.

- **Route**: `/briefing`, the default redirect from `/`. Visible to every
  logged-in user (spec §9 default — no extra permission).
- **Layout**: two brand columns (Prologue terracotta / Simply Books teal
  `#378573`), row-aligned on desktop, stacked one-venue-at-a-time on
  mobile. Location toggle shares the sidebar's venue switcher (persisted);
  the Detail toggle persists per device (`db-view`).
- **Data seam**: `lib/data/briefing*` — same pattern as Orders/Events. The
  mock supplies everything until integrations are configured; Deputy
  (roster + tasks, 10-min cache with "as of HH.MM") and Slack (read-only
  day-scoped chatter) overlay per-section via the env vars in
  `.env.example`. **Both adapters are written but unverified** — they need
  a Deputy permanent token and a Slack bot invited to `#pro-on-shift` /
  `#sb-on-shift`, which only Ben can provision (spec §2/§8). Field names
  should be confirmed against the live Deputy account on first connect
  (spec §9).
- **Weather**: live Open-Meteo (free, keyless), Stockport, 30-min cache;
  the pill simply hides if the forecast is unavailable.
- **Events**: read through the existing Events data source and filtered to
  the selected date server-side (`/api/briefing`), so briefing readers
  don't need `events:view`. Cards link into `/events/[id]` (which still
  enforces its own permission).
- **Wrap-ups + urgent alerts persist to the "Backstage" Airtable base**
  (general-purpose base for app features that need storage outside the
  Orders/Events bases; tables `Briefing Wrap-ups` and `Briefing Alerts` —
  schema in `lib/data/briefing-airtable.ts`). The base is discovered **by
  name** through the meta API — no base-id env var per base (Ben's rule).
  It switches on once `AIRTABLE_API_KEY` can see a base called
  "Backstage" (add it to the token's access list; the token also needs
  the `schema.bases:read` scope). `BACKSTAGE_AIRTABLE_BASE_ID` exists
  only as an override. Until reachable, wrap-ups/alerts fall back to
  in-memory mock state (resets on restart; not durable on Vercel).
  Alert dismissal flags `Dismissed` rather than deleting, so the base
  keeps an audit trail. Deputy→venue mapping likewise happens by
  location *name* (Prologue/Weir Mill, Simply/Bramhall), with
  `DEPUTY_LOCATION_ID_*` as numeric overrides only if a name mismatches.
- **Deliberately not built** (spec §4/§7): no parallel in-app task system
  (Deputy's tasks or nothing), and no auto-post of wrap-ups to Slack —
  whether the Slack post continues is an open question below.
- **Opening hours** come from the Backstage base too — a regular weekly
  pattern (`Opening Hours`: venue × weekday, with an Open/Close/Closed +
  note) plus a `Hours Overrides` table for date-specific exceptions (a
  late event night, or a full closure like Christmas; venue "Both"
  applies to both). Resolution: override for the date wins, else that
  weekday's regular row, else the built-in mock fallback. Editable in the
  base, no deploy needed. Logic in `lib/data/briefing-hours.ts`.
- Staff **milestones/birthdays** (§6) currently come from mock data; the
  Deputy Employee fields (start date / DOB) need checking before wiring
  them live, plus the privacy note in the spec (show "birthday today",
  never the full DOB).

## Book Clubs + Ordering Hub (Jul 2026)

Built from `book-clubs-ordering-hub-COMBINED.md` + the Claude Design file
**"Book Clubs & Ordering Hub.dc.html"** (same design project). Two coupled
modules: **Regular Events — Book Clubs Phase 1** (clubs, members, Stripe
subscriptions, monthly picks) and the **Ordering Hub** (staging → pending
batches → send → arrival, plus decision-support restock). Both sit in the
sidebar as **groups with a sub-menu** (Ben's ask): *Book clubs* →
Clubs / Members / Failed payments; *Ordering* → Staging / Pending queue /
Outstanding / Restock / Publishers, with live badge counts
(`/api/nav-counts`).

- **Shared list component** (`components/DataTable.tsx`) carries the spec's
  A2 data bar for every list view: multi-criteria chip filters that stay
  visible and clear easily, sortable columns with indicators, partial-match
  search, per-view persistence (localStorage), CSV export of the filtered
  rows, a row cap with "Show all" for performance, and a card layout below
  `md` instead of horizontal scrolling.
- **Data seams** follow the house pattern: `lib/data/clubs-*` and
  `lib/data/hub-*` (interface / mock / airtable), switched by
  `DATA_SOURCE`. Mock mode is fully self-contained — **no Airtable, no
  Stripe** — with deterministic seed data. The Airtable implementations
  (19 Jul 2026) map onto the **live "Book Clubs" base** (clubs / the
  Stripe-synced Members subscription rows / Book Orders / Publishers) plus
  the new **Hub Lines + Restock** tables in the Backstage base — the one
  central ordering table Ben chose over per-module order tables. Applied
  schema changes (all additive), live-base mapping quirks and remaining
  rollout steps: [docs/clubs-hub-migration.md](docs/clubs-hub-migration.md).
  ⚠️ Still needed: the Book Clubs base on the app token's access list, and
  the Stripe keys (Ben, in progress).
- **Members are standalone** from Customers (spec B1) — no linking or
  matching anywhere, deliberately. In airtable mode a "member" is derived by
  grouping the Stripe-synced subscription rows by Customer ID.
- **Stripe** (`lib/stripe.ts`, raw REST, no new dependency): reads
  (subscription status, invoice history — refunds view-only, issued in the
  dashboard) and writes (cancel immediate/period-end, native pause/resume,
  and **move-between-clubs as one guided flow**: cancel sub A + create sub
  B on the same customer). All writes are logged who/when on the
  membership. `/api/stripe/webhook` (HMAC-verified) keeps `Pay Status` live
  so **Failed payments** — its own nav item — never needs a Stripe login,
  and the Daily Briefing shows a "needs attention" chip for it.
- **Book selection → hub** (spec B4): one book per club per month;
  quantity is the exact active-member count with a +1 host-copy checkbox,
  computed server-side. Saving upserts a **draft in the hub** tagged
  `Book Club — <name>`; the selection stores only the hub line id and
  *reflects* its state (draft → pending → ordered → arrived) — status
  lives in one place.
- **Hub lifecycle** (spec C): nothing enters automatically — every source
  stages a draft (editable inline quantities, mandatory account with no
  default, RRP/discount/cost per line + batch total). Drafts persist
  forever; 7+ days unpushed = stale flag in Staging and on the briefing
  (`STALE_DRAFT_DAYS`, TBC with Ben). Deleting a draft is logged and never
  touches the originating record. The pending queue auto-batches by
  **publisher × account** (sources merge within a pairing — the point of
  the hub); **send is gated by `hub:send`** and shown locked, not hidden,
  to everyone else. Email path opens the user's mail app with the reviewed
  body and stores that exact copy against the batch; CSV download marks
  sent the same way. Sending is refused while the matching account number
  is missing. The email path opens **Gmail compose** in a new tab (the team
  sends from personal Gmail accounts) with the reviewed body pre-filled.
  Arrival is a single confirm (no partial receipts), writes back to customer
  orders ("Already In Stock" + status log) and to Book Orders ("Publisher
  Contacted" on send, "Received" on arrival) via the preserved source link,
  and Outstanding lists what to chase, sortable by days out.
- **Restock** (spec C5) is decision-support only: phone-first capture bar
  (barcode → ISBN lookup autofills title, publisher suggests the
  supplier), grouped by supplier with the Settings cadence badge, "mark
  handled" once ordered in **Batchline**. Never sent by the hub, no arrival
  tracking.
- **Discounts** (spec C6): straight % off RRP, Publisher × Order Type,
  restock as the base/fallback (customer orders use it), rare per-account
  override highlighted in the Publishers screen, imprints always inherit.
  Stored on the **existing Publishers table in the Events base** (rep
  contacts reused, not duplicated) — staff-editable behind
  `settings:manage`, never hardcoded.
- **Permissions** (spec C7): `hub:view` default for all roles (staging,
  arrivals, restock stay friction-free), `hub:send` manager-default,
  `clubs:view`/`clubs:manage` **explicit-grant only** for now — open
  question on CRM visibility flagged for Ben in the migration doc.
- **Venue tinting**: the whole surface re-tints to the venue being viewed
  (teal for Simply Books, terracotta otherwise), matching the design file.

## Returns module (Jul 2026, `returns-module` branch)

Built from `returns-module-spec.md` + the Claude Design file
**"Returns.dc.html"** (same design project). Replaces the old Returns
Airtable process with one shared queue: **request → approval (RA) →
shipping & credit**. Sits in the sidebar as its own group — *Returns* →
**To be returned** (staging) / **Pick lists** / **Outstanding** — with live
badge counts, under its own **`returns:view`** permission (Ben, 19 Jul):
default-on for both roles like `hub:view`, but a separate string so access
can be tailored per person. ⚠️ Clerk override semantics apply — any user
with an explicit `permissions` array in publicMetadata (including Ben)
needs `"returns:view"` added to it by hand, or the module disappears for
them.

- **New return** (`/returns/new`) is scanner-first: barcode/ISBN → the
  Orders lookup fills title, cover and publisher (imprints resolve to the
  parent via the Hub's Publishers data), re-scans bump quantity instead of
  duplicating, and lines group live by publisher — creation splits them
  into **one request per publisher**, always itemised. Reason ("slow-moving",
  "damaged"…) and condition are optional per line.
- **Staging — "To be returned"** (spec's open question: yes, it gets its
  own page, mirroring the Hub's To Order mental model). Grouped
  **publisher × shop** (never combined across shops) with the shop's own
  account number, a "can share one RA" nudge when several requests target
  the same rep, the mandatory **route** choice (Direct to publisher / Via
  Gardners — with rep-vs-portal hints), logged discard, and submit
  (single or all).
- **Lifecycle** uses the Orders V2 **clickable timeline** (forward one
  validated step, back any distance with confirm + cleared later dates).
  Every transition writes the audit trail (who/when). Approving captures
  the **RA number** (labelled "Gardners authorisation ref" on that route)
  plus an optional approval-form attachment.
- **Pick lists**: approved returns as progress cards; picking lives on
  the detail page's **Pick & box** panel — a barcode scan or each line's
  **Pick button** confirms copies (strike-through + tick, optimistic UI),
  and a shared quantity stepper lets either path confirm several copies
  at once (clamped at what's left; resets to 1 after each pick).
  *Confirm shipped* is locked until every copy is boxed.
- **Barcode scanning** works two ways: USB/Bluetooth scanners as keyboard
  input in any scan field (as in Orders), and **in-app camera scanning**
  via the browser-native `BarcodeDetector` API (Chrome/Edge/Android
  tablets, zero dependencies, continuous multi-scan). Where the API is
  missing (iOS Safari) the overlay explains and points at the hardware
  scanner path; a WASM decoder (zxing-wasm) can close that gap later if
  anyone actually scans from an iPhone.
- **Outstanding** (`/returns`) is the "what are we waiting on" view:
  search, chip filters (status/origin/route), sortable columns, CSV
  export, est. credit total (RRP less the publisher's restock discount —
  Hub rates reused), and **overdue flags** (Ben, 19 Jul): awaiting an RA
  > **3 working days** (`AWAITING_OVERDUE_WORKING_DAYS`) or shipped with
  no credit > **5 working days** (`SHIPPED_OVERDUE_WORKING_DAYS`) shows a
  red chase banner naming the rep. Working days = Mon–Fri; weekends never
  trigger a chase.
- **Event-originated returns** carry origin metadata (event name, verified
  by) end-to-end and show a distinct Event pill; Phase 6 reconciliation
  should POST `/api/returns` `action:create` with `origin:"event"` — the
  seam is ready, wiring it up is a Phase 6 task.
- **Data seams**: `lib/data/returns-*` (interface / mock / airtable),
  switched by `DATA_SOURCE`. Mock is self-contained with seed data across
  every stage. The two app-owned tables in the **Backstage** base were
  **created 19 Jul 2026** (`Return Requests` tbldEU7dwAZ6olicK,
  `Return Lines` tbletg9qngppb85Qq) — airtable mode is ready to point at
  them. For reference, the schema:
  **"Return Requests"** (Code, Location, Origin [General Stock/Event],
  Event Ref, Event ID, Verified By, Publisher ID, Route [Direct to
  Publisher/Via Gardners], Status [Requested/Awaiting Approval/Approved/
  Shipped/Credit Confirmed], RA Number, RA Filename, RA Attachment
  [attachment], Requested By, Date Requested/Submitted/Approved/Shipped/
  Credit Confirmed [dates], Credit Amount [currency], Notes, Log) and
  **"Return Lines"** (Request ID, Title, ISBN, Quantity, Reason,
  Condition, RRP, Picked). Note: the RA form's **binary upload** into the
  attachment field isn't wired yet (Airtable needs a public URL or the
  content-upload endpoint) — the filename is recorded and the field is
  ready; flagged rather than silently faked.
- **Publishers table**: no new fields strictly needed — rep name/email are
  reused as the chase contact. If a publisher's **returns contact** ever
  differs from the ordering rep (spec's open question), add optional
  "Returns Contact"/"Returns Email" columns and they can slot into the
  overdue banner; not added speculatively.

## Open questions for Ben

1. **One visual language or two?** The app is Prologue-branded overall with
   venue badges. If Simply Books needs its own look, the cleanest v1 move is
   venue-coloured badges/accents only (its brand book would slot into the
   same token system).
2. Confirm the **status consolidation mapping** above.
3. Confirm `NEEDS_ORDERING_STATUSES = ["Not Ordered", "Special Order"]`
   (lib/config.ts) is the right definition of "needs ordering" for the
   end-of-day list.
4. Vercel Hobby vs Pro (licensing note above).
5. **Daily Briefing setup** (all blocked on Ben): a Deputy permanent token
   + the Deputy location/OperationalUnit ids for each venue; a Slack bot
   token invited to `#pro-on-shift` and `#sb-on-shift`; and where wrap-ups
   / urgent alerts should persist (suggest a small Airtable table — see
   §Daily Briefing).
6. **Wrap-up → Slack**: keep the manual Slack post going, replace it with
   the in-app wrap-up, or run both during a transition (spec §7)? And is
   the wrap-up per-venue (as built, matching the design) or shared?
7. **Simply Books venue colour** app-wide changed from the old navy
   stand-in to the brand teal `#378573` (spec §0) — flag if any screen
   looks off with it.
