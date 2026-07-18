# Events Phase 2 — Airtable migration plan (needs Ben's sign-off)

**Status: NOT applied. The live base has not been touched.**

The Phase 2 app code (Events / Venues / Hosts screens, running order,
staffing, call sheets) ships working fully against mock data, and working
against the live base for every field that already exists. The pieces below
are the schema the live base is missing. Until they're applied (sandbox
first, then live, with Ben's approval — same rule as Phase 0),
`EVENTS_AIRTABLE_HAS_PHASE2` stays unset and the app:

- shows every live event as **Confirmed** (there is no Status field to read),
- shows the running order / staffing editors **read-only** with a notice,
  instead of accepting edits it would have nowhere to save,
- neither reads nor writes ISBN / From Pitch on events.
- leaves the shop Location filter empty until the separate Location field is ready.

Once the migration is applied and verified, set
`EVENTS_AIRTABLE_HAS_PHASE2=true` and everything unlocks — no code changes.

## 1. New fields on `Events` (tblfu5FnGG2WSiTNI)

| Field | Type | Options / notes |
| --- | --- | --- |
| `Status` | single select | `Confirmed`, `Provisional`, `Draft`, `Cancelled`. Backfill every existing record to `Confirmed` (they're all real bookings). |
| `ISBN` | barcode | Same type as Event Pitching's ISBN. The design's General tab has an ISBN field; the live table currently has nowhere to put it. |
| `From Pitch` | link → `Event Pitching` | The pitch a booking was converted from. Optional (standalone events leave it empty). |
| `Location` | single select | `Simply Books`, `Prologue`. This is the owning shop/account, not the venue's geographic Location field. Backfill from the operational owner of each event. |

After verifying the `Location` backfill, set
`EVENTS_AIRTABLE_HAS_EVENT_LOCATION=true`. It is deliberately a separate
flag so enabling the other Phase 2 fields cannot accidentally write to an
unmigrated Location column.

## 2. New table: `Event Roles`

The staffing join structure (spec §6.1): one row = one role on one event.

| Field | Type | Notes |
| --- | --- | --- |
| `Role` | single line text (primary) | e.g. "Signing table", "Staff bar" — free per event, **no fixed global role list** |
| `Event` | link → `Events` | |
| `Phase` | single select | `Pre show`, `During show`, `Post show` |
| `Staff` | long text | JSON array of `{id, name}` — `id` is the **Clerk user id** (one identity for sign-in and staffing, spec §6.1), `name` a display snapshot |

**Template-ready by design (flagging per spec §6.1):** roles are stored as
structured records — phase + role name + assigned people — precisely so the
future "apply role template" feature can insert a set of Event Roles rows
programmatically (e.g. the "big ticketed signing" set vs the "school
session" set). Nothing about templates is built yet; the data model just
doesn't block it. Same goes for the app's `EventRole[]` type and the
API's roles array — a template feature is "insert N role records", not a
redesign.

Why JSON-in-long-text for `Staff` rather than an Airtable collaborator
field: staff identity is Clerk, and Airtable collaborators are Airtable
accounts — the two can't be linked reliably. If Ben prefers one row per
(role, person) for Airtable-side reporting, that's a compatible variant —
say the word and the sync code changes in one place
(`syncEventChildren` in `lib/data/events-airtable.ts`).

## 3. New table: `Run of Show`

One row = one timed step of an event's call sheet.

| Field | Type | Notes |
| --- | --- | --- |
| `Title` | single line text (primary) | e.g. "Doors open · box office" |
| `Event` | link → `Events` | |
| `Time` | single line text | `HH:MM` 24-hour (text, not dateTime: it's a same-day clock time; keeps timezone out of it) |
| `Phase` | single select | `Pre show`, `During show`, `Post show` |
| `Note` | long text | |
| `Lead` | single line text | Clerk user id, the literal `host` (the event's host leads the step), or empty (unassigned) |

The app replaces an event's child rows wholesale on save (small counts, no
inbound references), so row ids are not stable — don't hang other schema
off them.

## 4. Schools "Session 1 / Session 2" restructure (confirmed by Ben, spec §2)

The hardcoded pairs `Event 1 Schools` / `Event 2 Schools` and
`School Attendees - Session 1` / `- Session 2` become a proper one-to-many:

**New table `Event Sessions`:** `Name` (primary, e.g. "Morning session"),
`Event` (link → Events), `School` (link → Schools), `Attendees` (number),
`Session Time` (single line text, optional).

**Data migration:** for each event with anything in the Session-1 fields,
create an `Event Sessions` row (school links + attendee count); same for
Session 2. Verify counts in the sandbox, then (only after Ben confirms)
hide — don't delete — the four legacy fields on the live base.

The Phase 2 UI doesn't render schools (that's Phase 5); this restructure is
scheduled here because Ben confirmed fixing the data shape properly now,
and Phase 5 should build on the new table, not the bolt-on pair.

## 5. Data-quality flags noticed while mapping (no action taken)

- `Venues.Capacity` is **text**, not a number ("150" today, but free text).
  The app treats it as text everywhere. Fine to leave; converting to a
  number field is optional polish.
- `Venues.Status` options are `Todo / In progress / Done` — task-tracker
  values, not venue lifecycle (`Active / External / Dormant` would fit the
  design better). App displays whatever is stored; changing the option set
  is Ben's call.
- `Venues.Tags` multi-select currently has **zero options** in the live
  base; the app writes tags as free strings only in mock mode. If tags are
  wanted live, add the options in Airtable first (the API won't invent
  select options — house rule).
- `Events.Staffing` (multi-select of first names) is superseded by Event
  Roles. The app shows it read-only as "legacy staffing" until migration,
  and stops writing it entirely. After the migration beds in, hide it.
- `Event Type` options include `To Categorise` and `External Selling `
  (trailing space is really in the option). Left as-is; the app preserves
  them exactly.

## 6. Runbook (when Ben approves)

1. Duplicate the live base in the Airtable UI ("Save as sandbox") and share
   it to the integration — same blocker as Phase 0: the MCP token can't
   create bases, so the sandbox has to be made in the UI.
2. Apply §1–§4 in the sandbox (field/table creation + Session backfill).
3. Point a dev deployment at the sandbox
   (`EVENTS_AIRTABLE_BASE_ID=<sandbox>`, `DATA_SOURCE=airtable`,
   `EVENTS_AIRTABLE_HAS_PHASE2=true`) and click through: events list,
   detail tabs, running order edit, staffing edit, call sheet, PDF.
4. Show Ben; get explicit sign-off.
5. Apply the same changes to the live base, set
   `EVENTS_AIRTABLE_HAS_PHASE2=true` in production.

## 7. Access model — CONFIRMED by Ben (16 Jul 2026)

- `events:view` / `events:edit` — the Events module (list/detail/venues/
  hosts) is **permission-only**: granted per-person in Clerk
  `publicMetadata.permissions`, same mechanism as pitching. Nobody gets it
  by default. (Same override caveat as pitching: an explicit `permissions`
  list replaces role defaults, so include `callsheet:view` — and
  `settings:manage` for managers — when granting, e.g.
  `["settings:manage", "callsheet:view", "events:view", "events:edit"]`.)
- `callsheet:view` — the day-of tier (spec §6.2): granted to **every role
  by default**, opens ONLY `/callsheet/<event>` for events the person is
  staffed on (events-module users can open any). No financials, no editing,
  no module access.
