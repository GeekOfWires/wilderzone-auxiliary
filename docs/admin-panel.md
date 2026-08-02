---
title: Admin Panel
nav_order: 5
---

# Admin Panel

React 18 + Vite + Tailwind + shadcn/ui, served by the worker at `/admin/`.

## Theming

Light / Dark / System modes with a toggle in the header. The default is
**System** — it follows your OS `prefers-color-scheme` and reacts to changes
live. Picking Light or Dark explicitly persists to local storage.

## Pages

### Login

`root` plus the password from `ROOT_PASSWORD` (or `tribes` if unset — you will
be forced to change it immediately).

### Setup wizard

Runs automatically on first login (missing root password change or zero
sources), and is re-enterable from **Sources → Run setup**:

1. Set the root password.
2. Seed the VPN CIDR list — fetches and parses the X4BNet list, then shows the
   entry count.
3. Done → Sources dashboard.

### Sources

Every CIDR source with its entry count, last refresh, and any fetch/parse
error. Toggle sources on/off, refresh manually, edit their
[format mapping](format-mappings), or delete them. Disabled or erroring
sources never participate in checks.

### Entries

Browse the normalized CIDRs of any source — search (`q`) and paginate. This is
a view onto the worker's cached list bodies, exactly what checks run against.

### API Keys

What you see depends on your role:

- **standard** — the **public key** card (viewable by everyone, since the service
  rate-limits it per requesting IP), a **Request API key** dialog, and your own
  request history with status badges. Approved requests reveal the minted key
  with a copy button.
- **admin / root** — the full keys table with create/revoke, plus a **Requests**
  section to approve (shows the minted key once) or deny (with a note) pending
  requests from standard users.

### Users (root only)

Add and remove panel users. New users get a temporary password and are forced
to change it on first login. Root and your own account can't be removed.

### Query Log

The rolling 48-hour log of every check: timestamp, player name, GUID, and the
flag result. Toggle **flagged only**, search by name or GUID, auto-refreshes
every 30 seconds.

- Clean hits keep only name + GUID — no IP, geo, or ISP is stored.
- VPN hits also record the matched CIDR/source plus IP, geo, and ISP for
  enforcement context.

{: .t2-muted }
Aliases don't hide anyone: the GUID is the TribesNEXT account's, so searching
a GUID surfaces every name that account played under in the window.

### Account

Change your password (current + new, minimum 8 characters). Forced on first
login when `must_change_password` is set.
