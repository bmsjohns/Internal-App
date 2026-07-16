# Events Phase 0 — Publisher/Imprint migration plan

**Status: awaiting Ben's decisions + sandbox. Nothing has been changed in the
live base.** Built from `events-phase0-publisher-imprint-spec.md`; all data
below verified against the live Events base (`apphUDuZ5u7NCisay`) on
**16 Jul 2026**.

## 1. Current state (verified, not assumed)

The spec's premise is half-fixed already:

- `Imprints.Publishers` — the parent link the spec asks for in step 2 —
  **already exists** (`fldWAVhSOlq5x7xxA`, single-record preference, no
  inverse field on Publishers) and is **populated for 98 of 103 imprints**.
- The duplicated fields on Imprints (Rep Name/Email/Phone, Standard Discount
  Terms, "Schools/Event Discouny", Distributor, Account Number) are **empty
  on every one of the 103 records**. There is no imprint-level data to
  preserve or migrate.

Who links to what today:

| Table | Field | Target | Usage |
|---|---|---|---|
| Event Pitching | `Publisher` (`fldlycWHzUBTr49lY`) | Publishers | **2 records** (Dame Denise Lewis → Hachette, Dr Julie → Penguin Random House; both Closed-Lost, neither has an Imprint) |
| Event Pitching | `Imprint` (`fldratEsgr3Ufk4TW`) | Imprints | ~50 records — already the primary link in practice |
| Stock Order | `Publishers` (`fldvpgyFZEhMEpbJX`) + 3 lookups (Rep Name, Rep Email, Distributor) | Publishers | **451 records** — the heavy user |
| Events | `Publisher(s)` (`fld3KlEmu7v5y2XBS`) | Publishers | **6 of 372 records** |
| Publishers | `Returns` (`fldFX0ILjZxloYQbV`) | — | misnamed: it is the *inverse* of Stock Order's link, not a returns list |

Publishers table (48 records) is a mix of true publishers (PRH, Hachette,
HarperCollins…), the **Faber Independent Alliance** (a rep/distribution
alliance whose "imprints" are independent publishers — Canongate, Granta,
Pushkin, Fitzcarraldo…), wholesalers/distributors (Gardners, BookSource,
InPress), and small presses. The big houses also carry a free-text
`Imprints` field duplicating what the Imprints table now models.

## 2. Decisions needed from Ben (spec §3.1 / §3.3–4)

### D1. Field ownership — recommendation: everything stays at Publisher level
Every duplicated field on Imprints is empty, so nothing is lost by deleting
them all from Imprints and treating Publisher as the single source of truth
(surfaced on other tables by lookup). If an imprint ever genuinely differs
(e.g. a different discount), add an explicit override field *then*, for that
field only. **Confirm: delete the 7 empty duplicated fields from Imprints?**

### D2. The five orphan imprints — recommendation: self-parent
Each has a same-name Publishers record holding the rep/account data, and
"HarperCollins imprint → HarperCollins publisher" already sets this pattern:

| Imprint (orphan) | Link to Publisher record |
|---|---|
| Simon & Schuster (`recYvBdaitmNpMp69`, 9 pitches attached) | Simon & Schuster (`recjHIBBencTMTSqk`) |
| Bloomsbury (`recXYGpRnFKSACNcj`) | Bloomsbury (`recCaF58JKU8s5GZC`) |
| Oxford University Press (`rec5qDu5VbSZA0IbD`) | Oxford University Press (`rechswxJxhI5UY2cO`) |
| Andersen Press (`rec6FqOC9uHrruhMm`) | Andersen Press (`recGhHahFcSQ01dPY`) |
| Pearson Education (`reccNjRdhQTNDzglv`) | Pearson (`recdQZ1Bgw6kTwMJE`) |

### D3. The two legacy publisher-only pitches
Both Closed-Lost. When `Publisher` becomes a lookup their publisher link
disappears, so first give each an Imprint (or accept losing the value):
- **Dame Denise Lewis** ("Adaptability") → Hachette. Suggest imprint: ?
- **Dr Julie** → Penguin Random House. Suggest imprint: Penguin Michael
  Joseph (her books' actual imprint) — confirm.

### D4. Faber Independent Alliance as "parent" — recommendation: keep
It's a rep alliance, not a publisher, but parent-in-the-ordering-sense is
exactly what the shop uses the hierarchy for (who reps it, what discount,
which account). Keeping it avoids inventing 20 single-imprint publishers.

### D5. Cross-table duplicate names (real §3.3 cleanup — Ben's call each)
Same name exists as both a Publishers record and an Imprints record:

| Name | Situation | Recommendation |
|---|---|---|
| Octopus | empty Publisher record + imprint under Hachette | delete the Publisher record |
| Scribe Publications | Publisher record (Faber rep, no links) + imprint under Alliance | delete the Publisher record |
| Canongate Books / Canongate | Publisher record (Faber rep, **1 Stock Order**) + imprint under Alliance | relink that Stock Order to Faber Independent Alliance, delete record |
| Dorling Kindersley (DK) | Publisher record (GBS, PRH's account no., **3 Stock Orders**) + imprint under PRH | Ben's call: keep (separate ordering route) or fold into PRH |
| Lonely Planet Kids / Lonely Planet | Publisher record (Faber rep) + imprint under Alliance | fold into Alliance |

(Also noted, not blocking: several small "Publishers" are arguably imprints
of Bonnier/Bounce etc. — Templar Books, Knights Of. Tidy opportunistically.)

## 3. Migration runbook

**Sandbox first (spec §3.6).** The MCP token has no workspace-create rights,
so: Ben duplicates the base in the Airtable UI (base menu → *Duplicate
base*, include records) and shares it with the integration. Every step
below is then executed on the sandbox via the API, verified, and only after
Ben's explicit sign-off repeated on the live base.

1. Rename Imprints' primary field "Publisher Name" → **"Imprint Name"**
   (it currently shares its name with the Publishers primary field — pure
   confusion). Rename Publishers' "Returns" → **"Stock Orders"**, and fix
   the "Schools/Event Discouny" typo on Publishers. (Renames are safe:
   Airtable references fields by id.)
2. Link the 5 orphan imprints to their parents (D2).
3. Apply D5 deletions/relinks.
4. Backfill Imprint on the 2 legacy pitches (D3).
5. Event Pitching: rename `Publisher` link → **"Publisher (legacy)"**;
   create new **"Publisher"** = lookup(`Imprint` → Imprints' `Publishers`
   link). Verify every pitch with an imprint shows the right publisher;
   verify the 2 backfilled ones. Delete "Publisher (legacy)" after
   verification (field deletion is a UI step — not exposed via the API).
6. Events table: same treatment as step 5 for `Publisher(s)` (6 records;
   backfill imprints or accept blanks — Ben's call per record).
7. Stock Order: **add** an `Imprint` link + "Publisher (from Imprint)"
   lookup, keep the existing `Publishers` link and its 3 lookups.
   ⚠️ *Deliberate deviation from spec step 5* ("every table links to
   Imprint only"): 451 live records link at publisher level and their
   correct imprints are not derivable from data we have — auto-mapping
   would fabricate precision. New stock orders can link imprints from day
   one; remapping history is Phase 3's call.
8. Imprints: delete the 7 empty duplicated fields (D1). Retire Publishers'
   free-text `Imprints` field (the link now models it) — hide first, delete
   once trusted.

## 4. App follow-up (after live migration)

`lib/data/events-airtable.ts` reads `Publisher` as a *link* (record ids →
names via the Publishers index). Once it's a lookup the cell returns
strings; the mapper needs a small change to accept both shapes during the
transition. The UI already treats Publisher as read-only-derived, so nothing
else changes. (One-line PR, ready to go when the migration lands.)
