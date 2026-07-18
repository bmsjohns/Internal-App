# Ordering Hub — Airtable migration plan

**Status: NOT applied. Apply to a duplicated base first and obtain Ben's
approval before changing the live base.** Customer Orders appear in the Hub
without this migration. New Restock lines remain disabled until it is applied.

## 1. Extend `Suppliers`

Keep the existing `Name`, `Cadence`, and `Account Number` fields during the
migration. Add:

| Field | Type | Notes |
| --- | --- | --- |
| `Simply Books Account` | single line text | Backfill from `Account Number`; verify per supplier. |
| `Prologue Account` | single line text | Enter the separate Prologue account. |
| `Rep Name` | single line text | Publisher/supplier representative. |
| `Rep Email` | email | Used only to open a reviewed email draft; the app never sends silently. |
| `Discount Threshold` | number, integer | Optional next useful copy-count threshold. Do not invent values. |
| `Threshold Note` | long text | Human guidance such as cadence or tier conditions. |

## 2. Create `Order Lines`

| Field | Type | Options / notes |
| --- | --- | --- |
| `Book Title` | single line text, primary | Required. |
| `Author` | single line text | |
| `ISBN` | barcode | |
| `Publisher` | single line text | Uses the corrected publisher name. A future linked-field migration can preserve the API shape. |
| `Imprint` | single line text | Uses the corrected imprint name. |
| `Quantity` | number, integer | Minimum 1. |
| `Price` | currency | Optional. |
| `Source` | single select | `Restock`, `Event`, `School`, `Book Club`, `Customer Order`, `Other`. |
| `Source Reference` | single line text | Optional originating record id. |
| `Location` | single select | `Simply Books`, `Prologue`. |
| `Status` | single select | `Not yet ordered`, `Ordered`, `Received`. |
| `Fulfillment Method` | single select | `Email to rep`, `CSV export`, `Batchline`. |
| `Actioned At` | date/time | Written when marked Ordered/Received. |
| `Actioned By` | single line text | Clerk display-name snapshot. |

`Created At` is Airtable's record creation timestamp and does not need a
separate writable field.

## 3. Verify and enable

1. Create several Restock lines in the sandbox for both shops.
2. Verify per-location account selection, threshold guidance, CSV content,
   email drafts, and the Actioned At/By audit values.
3. Confirm ordinary Customer Orders route to Batchline and only checked
   Gardners-sense Special Orders route to the rep-send view.
4. Set `AIRTABLE_HAS_ORDER_LINES=true` in the target environment and redeploy.
