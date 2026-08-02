---
title: Deployment
nav_order: 2
---

# Deployment

Prerequisites: [Node.js](https://nodejs.org), a Cloudflare account (Workers Paid
plan), and [`wrangler`](https://developers.cloudflare.com/workers/wrangler/)
authenticated with `npx wrangler login`.

## 1. Install

```bash
git clone https://github.com/GeekOfWires/tribes-proxy-check.git
cd tribes-proxy-check
npm install
```

## 2. Create storage

```bash
npx wrangler d1 create tribes-proxy-check-db
npx wrangler kv:namespace create LISTS
```

Paste the printed IDs into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "tribes-proxy-check-db"
database_id = "<your d1 id>"

[[kv_namespaces]]
binding = "LISTS"
id = "<your kv id>"
```

## 3. Migrate and set secrets

```bash
npm run db:migrate
npx wrangler secret put SESSION_SECRET     # any long random string (required)
npx wrangler secret put ROOT_PASSWORD      # optional initial root password
```

{: .t2-muted }
Without `ROOT_PASSWORD`, root's password is `tribes` and must be changed on
first login. Without `SESSION_SECRET`, session tokens are forgeable — always set it.

## 4. Deploy

```bash
npm run deploy   # builds the admin panel, then wrangler deploy
```

The worker goes live at `https://tribes-proxy-check.<your-subdomain>.workers.dev`.

## 5. First run

1. Open `https://<worker>/admin/` and log in as `root`.
2. The setup wizard walks you through setting the root password and seeding the
   X4BNet VPN CIDR list (shows the parsed entry count when done).
3. Open **API Keys**, mint a `server`-role key for your game server, and copy it —
   it is only shown once.

## 6. Wire up the game server

Drop the companion script (`gowWhoisVpn.cs`) into your Classic server's
`scripts/autoexec/`, delete any stale `.dso` files, and add to `prefs/serverPrefs.cs`:

```php
$Host::WhoisVpnWorkerHost = "tribes-proxy-check.<your-subdomain>.workers.dev";
$Host::WhoisVpnWorkerKey = "tpc_<your server-role key>";
$Host::AutoKickVPNs = 1;   // optional: auto-kick flagged players on connect
```

## Updating

```bash
git pull
npm install && npm --prefix app install
npm run db:migrate   # applies any new migrations
npm run deploy
tools/update-cidrs.sh   # optional: refresh the bundled fallback snapshot
```
