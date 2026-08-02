// index.ts - tribes-proxy-check worker.
//
// /tribes-api/check  game-facing one-line TSV VPN verdicts (API key auth)
// /api/*             JSON admin backend (session cookie, or admin Bearer key
//                    for key-management routes)
// /admin/*           React admin panel (static assets)
// cron               daily refresh of enabled CIDR sources

import { Hono } from "hono";
import { buildSet, ipToInt, isPrivateIp, lookup, parseSourceBody } from "./cidr";
import type { BuiltSet, SourceFormat, SourceRow } from "./cidr";
import { lookupIpInfo } from "./upstream";
import {
  clearSessionCookie,
  generateApiKey,
  hashPassword,
  readSessionCookie,
  sessionCookie,
  signSession,
  verifyPassword,
  verifySession,
} from "./auth";
import type { SessionPayload } from "./auth";
import { VPN_SNAPSHOT } from "./snapshot";

export interface Env {
  DB: D1Database;
  LISTS: KVNamespace;
  ASSETS: Fetcher;
  ROOT_PASSWORD?: string;
  SESSION_SECRET?: string;
}

interface ApiKeyRow {
  id: number;
  key: string;
  name: string;
  role: string;
  rate_limit: number | null;
  rate_window_s: number;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

const app = new Hono<{ Bindings: Env }>();

const X4BNET_VPN_URL = "https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/vpn/ipv4.txt";
const LOG_RETENTION_S = 48 * 60 * 60; // rolling 48h query log

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sessionSecret(env: Env): string {
  return env.SESSION_SECRET ?? "dev-insecure-secret-change-me";
}

async function getSession(c: { req: { raw: Request }; env: Env }): Promise<SessionPayload | null> {
  const token = readSessionCookie(c.req.raw);
  if (!token) return null;
  return verifySession(token, sessionSecret(c.env));
}

async function getAdminBearerKey(c: { req: { raw: Request }; env: Env }): Promise<ApiKeyRow | null> {
  const header = c.req.raw.headers.get("Authorization") ?? "";
  const m = /^Bearer\s+(tpc_[A-Za-z0-9]+)$/.exec(header.trim());
  if (!m) return null;
  return c.env.DB.prepare("SELECT * FROM api_keys WHERE key = ? AND role = 'admin' AND revoked_at IS NULL")
    .bind(m[1])
    .first<ApiKeyRow>();
}

// /api/* guard: session cookie OR (for key routes) admin bearer key
async function requireAdmin(c: any): Promise<Response | null> {
  const session = await getSession(c);
  if (session) return null;
  const bearer = await getAdminBearerKey(c);
  if (bearer) return null;
  return c.json({ error: "unauthorized" }, 401);
}

function sanitizeField(s: string): string {
  // TSV-safe, ASCII-only
  return s.replace(/[\t\r\n]+/g, " ").replace(/[^\x20-\x7E]/g, "").trim();
}

function jsonErr(c: any, msg: string, status = 400) {
  return c.json({ error: msg }, status);
}

// ---------------------------------------------------------------------------
// Rate limiting (KV fixed-window counters)
// ---------------------------------------------------------------------------

async function checkRateLimit(
  kv: KVNamespace,
  keyRow: ApiKeyRow,
  clientIp: string
): Promise<{ ok: boolean; retryAfter?: number }> {
  if (!keyRow.rate_limit) return { ok: true };
  const window = keyRow.rate_window_s || 3600;
  const now = Math.floor(Date.now() / 1000);
  const wstart = now - (now % window);
  const id =
    keyRow.role === "public"
      ? `rl:pub:${clientIp}:${wstart}`
      : `rl:key:${keyRow.id}:${wstart}`;
  const cur = parseInt((await kv.get(id)) ?? "0", 10) || 0;
  if (cur >= keyRow.rate_limit) return { ok: false, retryAfter: wstart + window - now };
  await kv.put(id, String(cur + 1), { expirationTtl: window });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// CIDR set: per-isolate merged build, refreshed from KV (5 min TTL)
// ---------------------------------------------------------------------------

let builtSet: BuiltSet | null = null;
let builtSetAt = 0;
const BUILT_TTL_MS = 5 * 60 * 1000;

async function getBuiltSet(env: Env): Promise<BuiltSet> {
  if (builtSet && Date.now() - builtSetAt < BUILT_TTL_MS) return builtSet;

  const sources = await env.DB.prepare("SELECT id, name FROM sources WHERE enabled = 1").all<{ id: number; name: string }>();
  const perSource: { name: string; body: string }[] = [];
  for (const row of sources.results) {
    const body = await env.LISTS.get(`src:${row.id}:raw`);
    if (body) perSource.push({ name: row.name, body });
  }

  // cold-start fallback: bundled snapshot (untagged "snapshot" source)
  if (perSource.length === 0 && VPN_SNAPSHOT) {
    perSource.push({ name: "X4BNet VPN (bundled snapshot)", body: VPN_SNAPSHOT });
  }

  builtSet = buildSet(perSource);
  builtSetAt = Date.now();
  return builtSet;
}

function invalidateBuiltSet() {
  builtSet = null;
}

// ---------------------------------------------------------------------------
// Source fetch + parse + store (used by refresh, seed, cron)
// ---------------------------------------------------------------------------

async function refreshSource(env: Env, id: number): Promise<{ ok: boolean; entryCount: number; error?: string }> {
  const source = await env.DB.prepare("SELECT * FROM sources WHERE id = ?").bind(id).first<SourceRow>();
  if (!source) return { ok: false, entryCount: 0, error: "source not found" };

  try {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`);
    const body = await res.text();
    const format = JSON.parse(source.format) as SourceFormat;
    const cidrs = parseSourceBody(body, format);
    if (cidrs.length === 0) throw new Error("parse produced 0 entries");

    await env.LISTS.put(`src:${id}:raw`, cidrs.join("\n"));
    await env.DB.prepare("UPDATE sources SET last_fetched_at = datetime('now'), entry_count = ?, last_error = NULL WHERE id = ?")
      .bind(cidrs.length, id)
      .run();
    invalidateBuiltSet();
    return { ok: true, entryCount: cidrs.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await env.DB.prepare("UPDATE sources SET last_error = ? WHERE id = ?").bind(msg, id).run();
    return { ok: false, entryCount: 0, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Lazy root-user init (applies ROOT_PASSWORD secret, or default "tribes")
// ---------------------------------------------------------------------------

let rootInitDone = false;
async function ensureRootInit(env: Env) {
  if (rootInitDone) return;
  rootInitDone = true;
  const row = await env.DB.prepare("SELECT pass_hash FROM users WHERE username = 'root'").first<{ pass_hash: string }>();
  if (row && row.pass_hash === "UNINITIALIZED") {
    const pw = env.ROOT_PASSWORD ?? "tribes";
    const { hash, salt } = await hashPassword(pw);
    const mustChange = env.ROOT_PASSWORD ? 0 : 1;
    await env.DB.prepare("UPDATE users SET pass_hash = ?, salt = ?, must_change_password = ? WHERE username = 'root'")
      .bind(hash, salt, mustChange)
      .run();
  }
}

// ===========================================================================
// Game-facing: /tribes-api/check
// ===========================================================================

app.get("/tribes-api/check", async (c) => {
  const ip = (c.req.query("ip") ?? "").trim();
  if (!ipToInt(ip)) return c.text("ERR\tinvalid-ip", 400);
  if (isPrivateIp(ip)) return c.text("ERR\tprivate-ip");

  const keyHeader = c.req.header("X-Tribes-Key") ?? "";
  const keyRow = await c.env.DB.prepare("SELECT * FROM api_keys WHERE key = ? AND revoked_at IS NULL")
    .bind(keyHeader)
    .first<ApiKeyRow>();
  if (!keyRow) return c.text("ERR\tbad-key", 401);

  const clientIp = c.req.header("CF-Connecting-IP") ?? "unknown";
  const rl = await checkRateLimit(c.env.LISTS, keyRow, clientIp);
  if (!rl.ok) {
    return c.text("ERR\trate-limited", 429, { "Retry-After": String(rl.retryAfter ?? 60) });
  }

  c.executionCtx.waitUntil(
    c.env.DB.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").bind(keyRow.id).run()
  );

  const set = await getBuiltSet(c.env);
  const hit = lookup(set, ip);
  const info = await lookupIpInfo(ip, c.executionCtx);

  const flagged = hit || info.proxy ? 1 : 0;
  const matched = hit ? hit.cidr : "-";

  // query log: non-flagged keeps name/guid/status only (no ip/geo/isp)
  const name = sanitizeField(c.req.query("name") ?? "");
  const guid = sanitizeField(c.req.query("guid") ?? "");
  const vpnDetail = hit ? `${hit.cidr} (${hit.source})` : info.proxy ? "ip-api proxy flag" : null;
  const logInsert = flagged
    ? c.env.DB.prepare(
        "INSERT INTO query_log (player_name, guid, flagged, vpn_detail, ip, geo, isp) VALUES (?, ?, 1, ?, ?, ?, ?)"
      ).bind(name, guid, vpnDetail, ip, [info.country, info.regionName, info.city].filter(Boolean).join(", "), info.isp)
    : c.env.DB.prepare("INSERT INTO query_log (player_name, guid, flagged) VALUES (?, ?, 0)").bind(name, guid);
  c.executionCtx.waitUntil(logInsert.run());
  c.executionCtx.waitUntil(
    c.env.DB.prepare("DELETE FROM query_log WHERE ts < datetime('now', ?)")
      .bind(`-${LOG_RETENTION_S} seconds`)
      .run()
  );

  const fields = [
    "OK",
    String(flagged),
    info.proxy ? "1" : "0",
    info.hosting ? "1" : "0",
    sanitizeField(matched),
    sanitizeField(info.country),
    sanitizeField(info.regionName),
    sanitizeField(info.city),
    sanitizeField(info.isp),
    sanitizeField(info.org),
    sanitizeField(info.as),
  ];
  return c.text(fields.join("\t"));
});

// ===========================================================================
// Admin JSON API: /api/*
// ===========================================================================

// ---- auth ----

app.post("/api/auth/login", async (c) => {
  await ensureRootInit(c.env);
  let body: { username?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return jsonErr(c, "invalid json");
  }
  const { username, password } = body;
  if (!username || !password) return jsonErr(c, "username and password required");

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(username).first<{
    id: number;
    username: string;
    pass_hash: string;
    salt: string;
    role: string;
    must_change_password: number;
  }>();
  if (!user || !(await verifyPassword(password, user.salt, user.pass_hash))) {
    return jsonErr(c, "invalid credentials", 401);
  }

  const token = await signSession(user.username, user.role, sessionSecret(c.env));
  c.header("Set-Cookie", sessionCookie(token));
  return c.json({ ok: true, username: user.username, mustChangePassword: user.must_change_password === 1 });
});

app.post("/api/auth/logout", (c) => {
  c.header("Set-Cookie", clearSessionCookie());
  return c.json({ ok: true });
});

app.get("/api/auth/me", async (c) => {
  const session = await getSession(c);
  if (!session) return jsonErr(c, "unauthorized", 401);
  const user = await c.env.DB.prepare("SELECT username, must_change_password FROM users WHERE username = ?")
    .bind(session.sub)
    .first<{ username: string; must_change_password: number }>();
  if (!user) return jsonErr(c, "unauthorized", 401);
  return c.json({ username: user.username, mustChangePassword: user.must_change_password === 1 });
});

app.post("/api/auth/password", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await c.req.json();
  } catch {
    return jsonErr(c, "invalid json");
  }
  if (!body.newPassword || body.newPassword.length < 8) {
    return jsonErr(c, "new password must be at least 8 characters");
  }

  const session = await getSession(c);
  if (!session) return jsonErr(c, "password changes require a panel session", 401);

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE username = ?").bind(session.sub).first<{
    pass_hash: string;
    salt: string;
  }>();
  if (!user) return jsonErr(c, "unauthorized", 401);
  if (!(await verifyPassword(body.currentPassword ?? "", user.salt, user.pass_hash))) {
    return jsonErr(c, "current password is wrong", 403);
  }

  const { hash, salt } = await hashPassword(body.newPassword);
  await c.env.DB.prepare("UPDATE users SET pass_hash = ?, salt = ?, must_change_password = 0 WHERE username = ?")
    .bind(hash, salt, session.sub)
    .run();
  return c.json({ ok: true });
});

// ---- setup (first-run wizard) ----

app.get("/api/setup/status", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const user = await c.env.DB.prepare("SELECT must_change_password FROM users WHERE username = 'root'")
    .first<{ must_change_password: number }>();
  const sources = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n, COALESCE(SUM(entry_count), 0) AS total FROM sources"
  ).first<{ n: number; total: number }>();
  const vpn = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM sources WHERE url = ?").bind(X4BNET_VPN_URL)
    .first<{ n: number }>();

  return c.json({
    rootPasswordSet: (user?.must_change_password ?? 1) === 0,
    sourceCount: sources?.n ?? 0,
    vpnSourceSeeded: (vpn?.n ?? 0) > 0,
    totalEntries: sources?.total ?? 0,
  });
});

app.post("/api/setup/seed-vpn", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let source = await c.env.DB.prepare("SELECT id FROM sources WHERE url = ?").bind(X4BNET_VPN_URL).first<{ id: number }>();
  let sourceId: number;
  if (source) {
    sourceId = source.id;
  } else {
    const res = await c.env.DB.prepare(
      "INSERT INTO sources (name, url, format, enabled) VALUES (?, ?, ?, 1)"
    )
      .bind("X4BNet VPN providers", X4BNET_VPN_URL, JSON.stringify({ type: "cidr-lines", skipPrefix: "#" }))
      .run();
    sourceId = Number(res.meta.last_row_id);
  }

  const result = await refreshSource(c.env, sourceId);
  if (!result.ok) return jsonErr(c, result.error ?? "refresh failed", 502);
  return c.json({ ok: true, sourceId, entryCount: result.entryCount });
});

// ---- sources CRUD ----

app.get("/api/sources", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const rows = await c.env.DB.prepare("SELECT * FROM sources ORDER BY id").all<SourceRow>();
  return c.json({ sources: rows.results });
});

app.post("/api/sources", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let body: { name?: string; url?: string; format?: SourceFormat; enabled?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return jsonErr(c, "invalid json");
  }
  if (!body.name || !body.url) return jsonErr(c, "name and url required");
  const format = body.format ?? { type: "cidr-lines" };

  const res = await c.env.DB.prepare("INSERT INTO sources (name, url, format, enabled) VALUES (?, ?, ?, ?)")
    .bind(body.name, body.url, JSON.stringify(format), body.enabled === false ? 0 : 1)
    .run();
  return c.json({ ok: true, id: Number(res.meta.last_row_id) });
});

app.put("/api/sources/:id", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const id = Number(c.req.param("id"));
  let body: { name?: string; url?: string; format?: SourceFormat; enabled?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return jsonErr(c, "invalid json");
  }

  const existing = await c.env.DB.prepare("SELECT id FROM sources WHERE id = ?").bind(id).first();
  if (!existing) return jsonErr(c, "not found", 404);

  await c.env.DB.prepare(
    "UPDATE sources SET name = COALESCE(?, name), url = COALESCE(?, url), format = COALESCE(?, format), enabled = COALESCE(?, enabled) WHERE id = ?"
  )
    .bind(
      body.name ?? null,
      body.url ?? null,
      body.format ? JSON.stringify(body.format) : null,
      body.enabled === undefined ? null : body.enabled ? 1 : 0,
      id
    )
    .run();
  invalidateBuiltSet();
  return c.json({ ok: true });
});

app.delete("/api/sources/:id", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("DELETE FROM sources WHERE id = ?").bind(id).run();
  await c.env.LISTS.delete(`src:${id}:raw`);
  invalidateBuiltSet();
  return c.json({ ok: true });
});

app.post("/api/sources/:id/refresh", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const result = await refreshSource(c.env, Number(c.req.param("id")));
  if (!result.ok) return jsonErr(c, result.error ?? "refresh failed", 502);
  return c.json({ ok: true, entryCount: result.entryCount });
});

app.get("/api/sources/:id/entries", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const id = Number(c.req.param("id"));
  const body = (await c.env.LISTS.get(`src:${id}:raw`)) ?? "";
  const q = (c.req.query("q") ?? "").trim();
  const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0);
  const limit = Math.min(500, Math.max(1, Number(c.req.query("limit") ?? 100) || 100));

  let entries = body === "" ? [] : body.split("\n");
  const totalBeforeFilter = entries.length;
  if (q) entries = entries.filter((e) => e.includes(q));

  return c.json({
    total: totalBeforeFilter,
    filtered: entries.length,
    offset,
    limit,
    entries: entries.slice(offset, offset + limit),
  });
});

// ---- API keys ----

app.get("/api/keys", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;
  const rows = await c.env.DB.prepare(
    "SELECT id, key, name, role, rate_limit, rate_window_s, created_by, created_at, revoked_at, last_used_at FROM api_keys ORDER BY id"
  ).all<ApiKeyRow>();
  return c.json({ keys: rows.results });
});

app.post("/api/keys", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  let body: { name?: string; role?: string; rateLimit?: number | null; rateWindowS?: number };
  try {
    body = await c.req.json();
  } catch {
    return jsonErr(c, "invalid json");
  }
  if (!body.name) return jsonErr(c, "name required");
  const role = body.role ?? "server";
  if (!["public", "server", "admin"].includes(role)) return jsonErr(c, "role must be public, server, or admin");

  const key = generateApiKey();
  const session = await getSession(c);
  await c.env.DB.prepare(
    "INSERT INTO api_keys (key, name, role, rate_limit, rate_window_s, created_by) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(key, body.name, role, body.rateLimit ?? null, body.rateWindowS ?? 3600, session?.sub ?? "admin-key")
    .run();
  // the full key is returned exactly once, here
  return c.json({ ok: true, key, name: body.name, role });
});

app.put("/api/keys/:id", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const id = Number(c.req.param("id"));
  let body: { name?: string; rateLimit?: number | null; rateWindowS?: number };
  try {
    body = await c.req.json();
  } catch {
    return jsonErr(c, "invalid json");
  }

  await c.env.DB.prepare(
    "UPDATE api_keys SET name = COALESCE(?, name), rate_window_s = COALESCE(?, rate_window_s) WHERE id = ?"
  )
    .bind(body.name ?? null, body.rateWindowS ?? null, id)
    .run();
  // rate_limit is only touched when explicitly present (null clears it)
  if (body.rateLimit !== undefined) {
    await c.env.DB.prepare("UPDATE api_keys SET rate_limit = ? WHERE id = ?")
      .bind(body.rateLimit, id)
      .run();
  }
  return c.json({ ok: true });
});

app.delete("/api/keys/:id", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

// ---- query log ----

app.get("/api/logs", async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const flaggedOnly = c.req.query("flagged") === "1";
  const q = (c.req.query("q") ?? "").trim();
  const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0);
  const limit = Math.min(500, Math.max(1, Number(c.req.query("limit") ?? 100) || 100));

  const where: string[] = ["ts >= datetime('now', ?)"];
  const binds: (string | number)[] = [`-${LOG_RETENTION_S} seconds`];
  if (flaggedOnly) where.push("flagged = 1");
  if (q) {
    where.push("(player_name LIKE ? OR guid LIKE ?)");
    binds.push(`%${q}%`, `%${q}%`);
  }
  const whereSql = where.join(" AND ");

  const total = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM query_log WHERE ${whereSql}`)
    .bind(...binds)
    .first<{ n: number }>();
  const rows = await c.env.DB.prepare(
    `SELECT id, ts, player_name, guid, flagged, vpn_detail, ip, geo, isp FROM query_log WHERE ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`
  )
    .bind(...binds, limit, offset)
    .all();

  return c.json({ total: total?.n ?? 0, offset, limit, rows: rows.results });
});

// ===========================================================================
// Admin panel assets + fallback
// ===========================================================================

app.get("/", (c) => c.redirect("/admin/"));

app.get("/admin/*", (c) => {
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace(/^\/admin/, "") || "/";
  return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
});

app.notFound((c) => jsonErr(c, "not found", 404));

// ===========================================================================
// Cron: daily refresh of all enabled sources
// ===========================================================================

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const sources = await env.DB.prepare("SELECT id FROM sources WHERE enabled = 1").all<{ id: number }>();
    for (const row of sources.results) {
      ctx.waitUntil(refreshSource(env, row.id));
    }
    // backstop prune of the rolling query log
    ctx.waitUntil(
      env.DB.prepare("DELETE FROM query_log WHERE ts < datetime('now', ?)")
        .bind(`-${LOG_RETENTION_S} seconds`)
        .run()
    );
  },
};
