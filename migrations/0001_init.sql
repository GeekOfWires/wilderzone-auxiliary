-- tribes-proxy-check initial schema
-- users + sources + api_keys + query_log, root user + default public key seeds

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT '{"type":"cidr-lines"}',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_fetched_at TEXT,
  entry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'server',
  rate_limit INTEGER,
  rate_window_s INTEGER NOT NULL DEFAULT 3600,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS query_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  player_name TEXT,
  guid TEXT,
  flagged INTEGER NOT NULL DEFAULT 0,
  vpn_detail TEXT,
  ip TEXT,
  geo TEXT,
  isp TEXT
);

CREATE INDEX IF NOT EXISTS idx_query_log_ts ON query_log(ts);
CREATE INDEX IF NOT EXISTS idx_query_log_flagged ON query_log(flagged);

-- Root admin. Default password is "tribes" and MUST be changed on first
-- login (the panel forces it). If the ROOT_PASSWORD secret is set at
-- deploy time, the worker replaces this hash on first request.
-- pass_hash/salt below are placeholders, replaced by the worker's init.
INSERT OR IGNORE INTO users (id, username, pass_hash, salt, role, must_change_password)
VALUES (1, 'root', 'UNINITIALIZED', 'UNINITIALIZED', 'admin', 1);

-- Default public API key. Rate limit is per requesting IP (see worker).
-- Rotate it in the admin panel if it ever leaks beyond "public".
INSERT OR IGNORE INTO api_keys (id, key, name, role, rate_limit, rate_window_s, created_by)
VALUES (1, 'tpc_public', 'Default public key', 'public', 20, 3600, 'system');
