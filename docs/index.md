---
title: Home
nav_order: 1
---

<div class="t2-hero" markdown="1">

# Wilderzone Auxiliary

**VPN/proxy detection for Tribes 2 game servers.** One HTTPS GET per player IP
returns geolocation, ip-api proxy/hosting flags, and a VPN-provider CIDR verdict
as a single tab-separated line — nothing for a 2001 game engine to store or parse.

[Deploy it](deployment){: .btn .btn-primary .fs-5 .mr-2 }
[API reference](api-reference){: .btn .fs-5 }

</div>

## What it does

- **`/tribes-api/check`** — one-line TSV verdict per IP, built to be absorbed by
  the QoL patch's `HTTPObject` and TorqueScript's `getField`.
- **VPN provider CIDR lists** — the X4BNet list seeded by a first-run wizard,
  refreshed daily by cron, cached in KV. Add your own sources with pluggable
  format mappings.
- **API keys** — `public` (20/hr per requesting IP), `server` (game servers),
  `admin` (machine-to-machine key minting).
- **Rolling 48-hour query log** — player names and GUIDs; clean hits retain
  nothing else, VPN hits retain the matched CIDR and enforcement context.
- **Admin panel** — React + shadcn/ui with light/dark/system theming.
- **Auth** — PBKDF2-HMAC-SHA256 password hashing, HMAC session cookies.

## The stack

| Piece | Choice |
|---|---|
| Runtime | Cloudflare Worker (Hono, TypeScript) |
| Database | Cloudflare D1 (SQLite) — users, sources, keys, query log |
| Cache | Cloudflare KV — raw CIDR bodies, rate-limit counters |
| Panel | React 18 + Vite + Tailwind + shadcn/ui (Workers Static Assets) |
| Geo upstream | ip-api.com (worker-side only) |
| List source | [X4BNet/lists_vpn](https://github.com/X4BNet/lists_vpn) |

## Quick links

- [Deployment guide](deployment)
- [Game API (TSV)](api-reference#game-facing-tribes-apicheck)
- [Admin API (JSON)](api-reference#admin-backend-api)
- [CIDR format mappings](format-mappings)
- [The admin panel](admin-panel)
- [Security notes](security)
