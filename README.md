<img src="docs/assets/wilderzone_aux.svg" alt="Wilderzone Auxiliary" width="480">

# Wilderzone Auxiliary Services

VPN/proxy detection API for Tribes 2 game servers, with a web admin panel.
Cloudflare Worker + D1 (SQLite) + KV + Workers Static Assets, TypeScript throughout.

Built for [Tribes 2](https://www.tribesnext.com/) servers running the TribesNEXT QoL
patch: the server script issues one HTTPS GET per player IP and gets back a single
tab-separated line with geolocation, ip-api proxy/hosting flags, and a VPN-provider
CIDR verdict — nothing to store or parse server-side beyond `getField`.

## Features

- **`/tribes-api/check`** — one-line TSV verdict per IP (geo, ISP/ASN, proxy/hosting flags, VPN CIDR match)
- **VPN provider CIDR lists** — X4BNet list seeded via a first-run wizard, refreshed daily by cron, cached in KV; custom sources with pluggable format mappings (cidr-lines, ip-lines, csv, json)
- **API keys** — roles `public` (rate-limited 20/hr **per requesting IP**), `server` (game servers), `admin` (machine-to-machine key minting); panel + API management
- **Rolling 48h query log** — player names + GUIDs; clean hits retain nothing else, VPN hits retain the matched CIDR plus enforcement context
- **Admin panel** — React + shadcn/ui, light/dark/system theme (defaults to system), sources, entries browser, API keys, query log, setup wizard, password management
- **Auth** — PBKDF2-HMAC-SHA256 (100k iterations) in D1, HMAC-signed session cookies

## Architecture

```
Tribes 2 server                Cloudflare Worker (Hono, TypeScript)          Storage
-----------------              --------------------------------------         -------
HTTPObject GET              /tribes-api/check (X-Tribes-Key)              KV: raw CIDR bodies per source
  /tribes-api/check  -->    /api/*  JSON admin backend  ------------->    D1: users, sources, api_keys,
  one-line TSV              /admin/* React panel (static assets)              query_log
                                                                       Cron: daily source refresh
```

## Deploy

Prereqs: [Node.js](https://nodejs.org), a Cloudflare account (Workers Paid plan),
[`wrangler`](https://developers.cloudflare.com/workers/wrangler/) authenticated
(`npx wrangler login`).

```bash
npm install

# 1. Create the D1 database and KV namespace, then paste the IDs into wrangler.toml
npx wrangler d1 create wilderzone-aux-db
npx wrangler kv:namespace create LISTS

# 2. Run the migration
npm run db:migrate          # remote; use db:migrate:local for local dev

# 3. Set secrets
npx wrangler secret put SESSION_SECRET     # any long random string (required)
npx wrangler secret put ROOT_PASSWORD      # optional initial root password

# 4. Build the panel and deploy
npm run deploy
```

The worker goes live at `https://wilderzone-aux.<your-subdomain>.workers.dev`.

**First run:** open `/admin/`, log in as `root` (password = `ROOT_PASSWORD` secret,
or `tribes` if unset — you'll be forced to change it), and the setup wizard seeds
the X4BNet VPN CIDR list. Then mint a `server`-role API key on the **API Keys**
page for your game server.

### Game server setup (Tribes 2)

Drop the companion script into your Classic server's `scripts/autoexec/`, then in
`prefs/serverPrefs.cs`:

```
$Host::WhoisVpnWorkerHost = "wilderzone-aux.geekofwires.workers.dev";
$Host::WhoisVpnWorkerKey = "tpc_<your server-role key>";
$Host::AutoKickVPNs = 1;   // optional: auto-kick flagged players on connect
```

## API

### Game-facing: `GET /tribes-api/check`

```
GET /tribes-api/check?ip=1.2.3.4&name=PlayerName&guid=12345
X-Tribes-Key: tpc_...
Accept: text/plain
```

Response: one line, `text/plain`, **tab-separated**:

```
OK	1	1	0	5.134.116.0/24	US	California	Sacramento	M247 Ltd	M247 Ltd	AS9009
```

| idx | field | notes |
|---|---|---|
| 0 | status | `OK` / `ERR` |
| 1 | flagged | `1` = VPN hit (CIDR list or ip-api proxy flag) |
| 2 | proxy | ip-api proxy flag |
| 3 | hosting | ip-api hosting flag — **informational only, never flags** (false-positives on residential ISPs) |
| 4 | matched CIDR | or `-` |
| 5–7 | country, region, city | |
| 8–10 | isp, org, as | |

Errors: `ERR\tinvalid-ip` (400), `ERR\tprivate-ip`, `ERR\tbad-key` (401), `ERR\trate-limited` (429 + `Retry-After`).

### Admin backend: `/api/*` (JSON)

Session cookie auth (from `auth/login`); key-management routes also accept
`Authorization: Bearer tpc_<admin-role-key>`.

| route | description |
|---|---|
| `POST /api/auth/login` | `{username,password}` → session cookie |
| `POST /api/auth/logout` | clear session |
| `GET /api/auth/me` | current user |
| `POST /api/auth/password` | change own password (min 8 chars) |
| `GET /api/setup/status` | wizard state |
| `POST /api/setup/seed-vpn` | seed + fetch the X4BNet VPN list (idempotent) |
| `GET/POST /api/sources` | list / create CIDR sources |
| `GET/PUT/DELETE /api/sources/:id` | read / update / delete |
| `POST /api/sources/:id/refresh` | fetch + parse now |
| `GET /api/sources/:id/entries` | paginated CIDR browser (`offset`, `limit`, `q`) |
| `GET/POST /api/keys` | list / mint API keys (full key returned once) |
| `PUT/DELETE /api/keys/:id` | rename / change rate / revoke |
| `GET /api/logs` | rolling 48h query log (`flagged=1`, `q`, `offset`, `limit`) |

### API key roles

| role | purpose | rate limit |
|---|---|---|
| `public` | casual use; one default key seeded (`tpc_public`), **viewable by all panel users** | 20/hour **per requesting IP** |
| `server` | game servers | unlimited (configurable) |
| `admin` | machine-to-machine key minting via `/api/keys` | n/a |

### Panel user roles

| role | can do |
|---|---|
| `standard` | view Sources and Entries, view the public API key, **request** API keys |
| `admin` | standard + Query Log, create/revoke API keys, **approve/deny key requests** |
| `root` | admin + add/remove panel users (only root) |

### Key requests

Standard users request keys; admins/root review them.

| route | notes |
|---|---|
| `POST /api/keys/requests` | `{name, note?}` — creates a pending request (any user) |
| `GET /api/keys/requests/mine` | the requester's own requests; approved ones include `granted_key` |
| `GET /api/keys/requests?status=pending` | admin/root: all requests |
| `POST /api/keys/requests/:id/approve` | admin/root: mints the key (returned once here too) |
| `POST /api/keys/requests/:id/deny` | admin/root: `{note?}` |

### User management (root only)

| route | notes |
|---|---|
| `GET /api/users` | list panel users |
| `POST /api/users` | `{username, password, role}` — role `admin` or `standard`; new users must change password on first login |
| `DELETE /api/users/:id` | cannot remove root or yourself |

## CIDR source format mappings

`sources.format` is a JSON object:

```jsonc
// one CIDR per line (X4BNet)
{ "type": "cidr-lines", "skipPrefix": "#" }
// one bare IP per line (expanded to /32)
{ "type": "ip-lines", "skipPrefix": "#" }
// CSV with columns
{ "type": "csv", "ipColumn": 0, "cidrColumn": 1, "delimiter": ",", "hasHeader": true }
// JSON array
{ "type": "json", "path": "items[*].ip" }
```

## Development

```bash
npm install
npm --prefix app install
npm run dev                  # worker dev server (wrangler dev)
npm --prefix app run dev     # panel dev server (Vite)
npm run typecheck            # worker TS
npm run build:app            # panel production build -> app/dist
tools/update-cidrs.sh        # regenerate the bundled fallback snapshot
```

## Security notes

- Passwords: PBKDF2-HMAC-SHA256, 100k iterations, per-user salt.
- Sessions: HMAC-SHA256 signed cookies, 12h, HttpOnly + Secure + SameSite=Lax.
- Set `SESSION_SECRET` in production or session tokens are forgeable.
- API keys are shown once at creation; the default `tpc_public` key is rate-limited
  per requesting IP and can be rotated in the panel.
- Query log retention is privacy-conscious by design (see above).

## License

MIT — see [LICENSE](LICENSE).

---

Maintained by **GeekOfWires** \<GeekOfWires@users.noreply.github.com\>.
