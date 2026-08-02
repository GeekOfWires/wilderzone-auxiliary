---
title: Development
nav_order: 7
---

# Development

## Layout

```
src/index.ts            worker entry: Hono routes (/tribes-api/*, /api/*, assets), cron
src/cidr.ts             format-mapping parsers, merged range set, binary search
src/auth.ts             PBKDF2 hashing, HMAC session tokens, key generation
src/upstream.ts         ip-api geo/flags with 6h edge cache
src/snapshot.ts         bundled X4BNet fallback (generated)
migrations/             D1 schema + seeds
app/                    React admin panel (Vite + TS + Tailwind + shadcn/ui)
tools/update-cidrs.sh   regenerate the fallback snapshot
```

## Local dev

```bash
npm install
npm --prefix app install

# worker with local D1/KV emulation
npm run db:migrate:local
npm run dev

# panel dev server (hot reload), proxies nothing - point it at the dev worker
npm --prefix app run dev
```

## Checks

```bash
npm run typecheck          # worker TypeScript
npm --prefix app run build # panel: tsc + vite build
```

## Updating the fallback snapshot

The bundled snapshot (`src/snapshot.ts`) is only used before KV is seeded, but
keep it fresh:

```bash
tools/update-cidrs.sh
```

A weekly GitHub Action can automate this (fetch → regenerate → pull request).

## Conventions

- TypeScript strict everywhere; `@cloudflare/workers-types` for the worker.
- The TSV contract in `/tribes-api/check` is **stable** — game servers in the
  wild parse it by field index. Add new fields only at the end.
- Migrations are append-only files (`migrations/0002_*.sql`, …) applied with
  `npm run db:migrate`.
