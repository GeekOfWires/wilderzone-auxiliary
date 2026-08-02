-- 0002: role system (root/admin/standard) + API key requests

-- The seeded root account gets the root role; root is the only role that
-- can add/remove users.
UPDATE users SET role = 'root' WHERE username = 'root';

-- API key requests: standard users request keys, admins/root approve or deny.
CREATE TABLE IF NOT EXISTS key_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'server',
  requested_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | denied
  note TEXT,
  granted_key TEXT,                        -- set on approval, visible to the requester
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by TEXT,
  reviewed_at TEXT
);
