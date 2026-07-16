# Order Book — internal ops platform

Internal ops platform for **Simply Books** (Bramhall) and **Prologue Books**
(Weir Mill, Stockport). Modules so far: **Customer Orders** (V3) and **Events
Phase 1: Pitching** (see §Events below). Next.js 15 (App Router) · Clerk ·
Airtable · Tailwind 4, deployed on Vercel.

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
Until then the code runs with `AIRTABLE_HAS_NEW_FIELDS=false`: it neither
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
`AIRTABLE_API_KEY` (a scoped PAT: data read/write on this base only),
`AIRTABLE_BASE_ID=appAlp6BBobAiV0d6`, `AIRTABLE_HAS_NEW_FIELDS`, the two Clerk
keys. Works behind a custom domain later.

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
  status / venue / event type. Mobile gets stacked cards instead of the table.
- `/events/[id]` — one screen, five sub-tabs (design brief §2): General,
  Show details, **Running order** (time-sequenced plan by Pre/During/Post
  show phase, inline step editing, live "Now / Up next" markers from the
  device clock), **Staffing** (per-event roles defined within each phase,
  people assigned per role, gaps called out, roster cards), Book orders
  (Phase 3 placeholder). Existing events **autosave optimistically**
  (debounced PATCH, Saved/Retry states); `/events/new` accumulates a draft
  and POSTs. "Convert to booking" on a won pitch opens
  `/events/new?fromPitch=<id>` with author/title/ISBN/venue carried over.
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
  poor signal: data snapshots to `localStorage`, a **service worker**
  (`public/sw.js`) caches the page shell + static assets on the FIRST load
  (the page primes its own URL into the cache), so it keeps working — and
  survives a reload — after connectivity drops. This is the app's one
  deliberate offline surface; nothing else registers the SW.

**Access tiers** (lib/auth.ts): `events:view` / `events:edit` granted
per-person in Clerk like pitching (open question: default on for whole
team? — see docs/events-phase2-migration.md §7), and `callsheet:view`
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
