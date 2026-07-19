# Team & Permissions rollout

The permissioning UI is complete in mock mode. Production uses Clerk for each
person's access profile and two small tables in the existing **Backstage**
Airtable base for shared role defaults and audit history. Nobody needs to edit
those tables after rollout; all day-to-day changes happen inside Backstage.

## 1. Bootstrap the first Admin

Set `PERMISSIONS_BOOTSTRAP_ADMIN_EMAILS` to one or more existing Clerk email
addresses for the first deploy. Those people resolve as Admins independently
of their current metadata and can open **Settings → Team & Permissions**.
After assigning at least two Admins through the UI, the bootstrap variable can
remain as break-glass access or be removed once the matching Clerk metadata has
been saved through the UI.

Admin cannot edit or deactivate their own account, and the API refuses to
deactivate the final active Admin.

## 2. Add Backstage base tables

### Permission Roles

| Field | Airtable type | Notes |
|---|---|---|
| Name | single line text (primary) | Display name |
| Slug | single line text | `manager`, `events-lead`, `bar-floor-staff`, `book-club-manager` |
| Description | long text | Role summary |
| Permissions | long text | App-maintained JSON array |
| Locked | checkbox | Admin remains locked in code |

The UI falls back to the starter matrix if this table has not been migrated,
so reads stay available. Saving a role requires the table.

### Permission Audit

| Field | Airtable type |
|---|---|
| At | date/time (include time) |
| Actor | single line text |
| Action | long text |
| Target | single line text |

Clerk also retains the metadata mutation. A temporary audit-table failure does
not roll back an access change or leave a person half-configured.

## 3. Clerk metadata shape

The UI writes:

```json
{
  "roleId": "events-lead",
  "locations": ["Prologue"],
  "permissionOverrides": [
    { "permission": "ordering.send", "location": "Prologue", "effect": "grant" }
  ]
}
```

Existing `role`, `managerLocations` and `permissions` metadata continues to be
read during migration. New writes use the tuple-based shape above.

## Product decision applied

Removing access is a soft deactivation through Clerk, not a hard delete. This
preserves stable user IDs and names in Orders, Events and subscription audit
history. Admins can reactivate the same account from the team screen.
