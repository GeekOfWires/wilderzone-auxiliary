---
title: Security
nav_order: 6
---

# Security Notes

## Passwords

PBKDF2-HMAC-SHA256, 100,000 iterations, per-user 16-byte salt, hashes stored in
D1. Verification uses a constant-time comparison. The root account is seeded by
migration; set `ROOT_PASSWORD` at deploy or change the default `tribes`
password on first login (the panel forces it).

## Sessions

HMAC-SHA256 signed tokens in a cookie: `HttpOnly`, `Secure`, `SameSite=Lax`,
12-hour expiry. **Set the `SESSION_SECRET` secret in production** — without it
the worker falls back to a known dev secret and session tokens are forgeable.

## API keys

- Generated as `tpc_` + 128 bits of CSPRNG, stored in D1, shown once at creation.
- `public` keys are rate-limited per requesting IP (20/hour default) so one
  caller can't exhaust the allowance of every other server sharing the key.
- `admin` keys can mint new keys via the API — treat them like the root
  password and only hand them to trusted automation.
- Revoking is instant (checked on every request).

## Query log retention

Privacy-conscious by design:

- Clean hits: player name + GUID + timestamp only. **No IP, geo, or ISP is
  ever stored for them.**
- VPN hits: additionally the matched CIDR/source plus IP, geo, ISP (needed for
  enforcement).
- Everything older than 48 hours is deleted on every insert, with a daily
  cron backstop.

## Transport

All traffic is HTTPS (Cloudflare edge). The only plaintext leg is the worker's
upstream call to ip-api.com's free tier, which contains nothing but the queried
IP.

## Hardening checklist

- [ ] `SESSION_SECRET` set to a long random string
- [ ] `ROOT_PASSWORD` set (or default changed at first login)
- [ ] `server` keys per game server (not shared)
- [ ] `admin` keys only in trusted automation
- [ ] `tpc_public` rotated if it escapes beyond public use
