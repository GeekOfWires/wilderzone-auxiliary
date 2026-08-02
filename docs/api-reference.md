---
title: API Reference
nav_order: 3
---

# API Reference

## Game-facing: `/tribes-api/check`

One IP in, one tab-separated line out. Authenticated with an API key.

```
GET /tribes-api/check?ip=1.2.3.4&name=PlayerName&guid=12345
X-Tribes-Key: tpc_...
Accept: text/plain
```

`name` and `guid` are optional and only feed the [query log](admin-panel#query-log).

### Response

One line, `text/plain`, **tab-separated**, ASCII only:

```
OK	1	1	0	5.134.116.0/24	US	California	Sacramento	M247 Ltd	M247 Ltd	AS9009
```

| idx | field | notes |
|---|---|---|
| 0 | status | `OK` / `ERR` |
| 1 | flagged | `1` = VPN hit (CIDR list match or ip-api proxy flag) |
| 2 | proxy | ip-api proxy flag |
| 3 | hosting | ip-api hosting flag — **informational only, never flags** |
| 4 | matched CIDR | or `-` |
| 5 | country | |
| 6 | region | |
| 7 | city | |
| 8 | isp | |
| 9 | org | |
| 10 | as | e.g. `AS9009` |

{: .t2-muted }
The hosting flag is deliberately excluded from flagging: datacenter lists and
hosting heuristics false-positive on ordinary residential ISPs.

### Errors

| response | status | meaning |
|---|---|---|
| `ERR	invalid-ip` | 400 | malformed IPv4 |
| `ERR	private-ip` | 200 | private/loopback range — nothing to check |
| `ERR	bad-key` | 401 | missing, unknown, or revoked key |
| `ERR	rate-limited` | 429 | over the key's rate limit (`Retry-After` header set) |

### TorqueScript consumer

The QoL patch's libcurl-backed `HTTPObject` handles the HTTPS; the response
parses with `getField`:

```php
%http = new HTTPObject(WhoisVpnHttp);
%http.setHeader("Accept", "text/plain");
%http.setHeader("X-Tribes-Key", $Host::WhoisVpnWorkerKey);
%http.get($Host::WhoisVpnWorkerHost, "/tribes-api/check?ip=" @ %ip);

function WhoisVpnHttp::onLine(%this, %line) {
   if(getField(%line, 0) $= "OK")
      %flagged = getField(%line, 1);
}
```

---

## Admin backend: `/api/*`

All responses JSON. Session cookie auth from `auth/login`; the key-management
routes additionally accept `Authorization: Bearer tpc_<admin-role-key>`.

### Auth

| route | body | result |
|---|---|---|
| `POST /api/auth/login` | `{username, password}` | session cookie; `{ok, username, mustChangePassword}` |
| `POST /api/auth/logout` | — | clears cookie |
| `GET /api/auth/me` | — | `{username, mustChangePassword}` |
| `POST /api/auth/password` | `{currentPassword, newPassword}` | min 8 chars |

### Setup (first-run wizard)

| route | result |
|---|---|
| `GET /api/setup/status` | `{rootPasswordSet, sourceCount, vpnSourceSeeded, totalEntries}` |
| `POST /api/setup/seed-vpn` | idempotent; `{ok, sourceId, entryCount}` |

### CIDR sources

| route | notes |
|---|---|
| `GET /api/sources` | all sources with stats |
| `POST /api/sources` | `{name, url, format, enabled}` |
| `PUT /api/sources/:id` | partial update |
| `DELETE /api/sources/:id` | also drops the cached body |
| `POST /api/sources/:id/refresh` | fetch + parse now → `{ok, entryCount}` |
| `GET /api/sources/:id/entries` | `offset`, `limit`, `q` — paginated CIDR browser |

### API keys

| role | purpose | rate limit |
|---|---|---|
| `public` | casual use; default `tpc_public` seeded | 20/hour **per requesting IP** |
| `server` | game servers (`X-Tribes-Key`) | unlimited by default |
| `admin` | machine-to-machine key minting | n/a |

| route | notes |
|---|---|
| `GET /api/keys` | list (revoked keys shown dimmed) |
| `POST /api/keys` | `{name, role, rateLimit?, rateWindowS?}` — **full key returned once** |
| `PUT /api/keys/:id` | rename / change rate (`rateLimit: null` = unlimited) |
| `DELETE /api/keys/:id` | revoke |

### Query log

`GET /api/logs?flagged=1&q=&offset=&limit=` → `{total, offset, limit, rows}`.

Rolling 48 hours. Rows: `{id, ts, player_name, guid, flagged, vpn_detail, ip, geo, isp}`.
Clean hits only retain `ts`, `player_name`, `guid` — IP, geo, and ISP are never
stored for them.
