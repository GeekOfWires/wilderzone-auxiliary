-- 0003: separate WZA API key table
--
-- WZA API Keys authenticate game servers against generic Wilderzone Auxiliary
-- API functions (starting with /tribes-api/tag). They are deliberately NOT
-- part of the api_keys table: those keys gate the whois/VPN check endpoint
-- and carry a public/server/admin role model that does not apply here.

CREATE TABLE IF NOT EXISTS wza_api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  rate_limit INTEGER,
  rate_window_s INTEGER NOT NULL DEFAULT 3600,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  last_used_at TEXT
);
