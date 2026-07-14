# Order Book — Customer Orders module

Phase 1 of the internal ops platform for **Simply Books** (Bramhall) and
**Prologue Books** (Weir Mill, Stockport). Replaces the Airtable UI for the
"Customer Orders" base. Next.js 15 (App Router) · Clerk · Airtable · Tailwind 4,
deployed on Vercel.

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
| Orders | Location | single select: `Simply Books`, `Prologue`   | The one Ben flagged. After adding it, select-all existing records → set to `Simply Books` (confirmed default for all past orders). |
| Orders | Notes    | long text                                   | Beyond spec: there is nowhere to record per-order context ("wants it signed", "reprint due"). The form and detail page support it. |

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

### Status field — proposal, not yet applied

The 18 status options overlap (three flavours of "Ordered"; "Not paid"
duplicating the Paid? field). The app ships with all 18 **grouped** in the UI
(To do / In progress / Ready / Problems / Closed) so nothing breaks, and the
"Legacy" group marks `Not paid` as avoid. Proposed consolidation for a later
pass, once Ben confirms the mapping:

- `Not Ordered`, `Special Order`, `preordered` → **To order**
- `Ordered`, `Ordered - In Basket`, `Ordered - extended catalogue` → **Ordered**
- `Ready to Ship`, `Delivery` → **Ready**, `Shipped`/`Collected` → **Done**
- `Not paid` → delete (use Paid? field), `Issue Resolved` → whatever state it resolved to

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

## Brand

Colours from the Prologue Brand Guidelines V1.0 (paper `#F5F3EF`, rust
`#AD3B28`, coral `#DA4F4A`, blush `#F5ADB0`, shell `#FBDCDC`) as Tailwind
tokens in `app/globals.css`. The brand faces (New Spirit / Good Sans) are
licensed; **Fraunces / Figtree** stand in via `--font-display` / `--font-sans`
— if Ben has webfont licences (New Spirit is on Adobe Fonts), load them and
update the two variables. Venue badges: Prologue = brand rust; Simply Books =
neutral ink pending its own identity (open question below).

## Beyond spec (spec §2b — flagged, not silent)

- **ISBN → title/author auto-fill** on scan/Enter (OpenLibrary, Google Books
  fallback; both free/keyless). Supports the "speed of entry" goal: scan,
  glance, save.
- **Orders.Notes field** (see migration table).
- **End-of-day summary groups duplicate ISBNs** into one row with quantity,
  and has a venue toggle + date picker (yesterday's list on a busy morning).
- **Dev/mock data source** — doubles as the safe-sandbox requirement.

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
