export type SourceFormatType = "cidr-lines" | "ip-lines" | "csv" | "json";

export interface SourceFormat {
  type: SourceFormatType;
  skipPrefix?: string; // cidr-lines / ip-lines: comment marker
  ipColumn?: number; // csv: index of column holding IP or CIDR
  cidrColumn?: number; // csv: index of column holding CIDR (wins over ipColumn)
  delimiter?: string; // csv: default ","
  hasHeader?: boolean; // csv: skip first line
  path?: string; // json: e.g. "items[*].ip" or "[*]"
}

export interface Source {
  id: number;
  name: string;
  url: string;
  format: string; // JSON string of SourceFormat
  enabled: number; // 0 | 1
  last_fetched_at: string | null; // "YYYY-MM-DD HH:MM:SS" UTC
  entry_count: number;
  last_error: string | null;
}

export interface ApiKey {
  id: number;
  key: string;
  name: string;
  role: "public" | "server" | "admin";
  rate_limit: number | null;
  rate_window_s: number | null;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

export interface WzaKey {
  id: number;
  key: string;
  name: string;
  rate_limit: number | null;
  rate_window_s: number | null;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

export interface LogRow {
  id: number;
  ts: string; // "YYYY-MM-DD HH:MM:SS" UTC
  player_name: string;
  guid: string;
  flagged: number; // 0 | 1
  vpn_detail: string | null;
  ip: string | null;
  geo: string | null;
  isp: string | null;
}

export interface PlayerResult {
  guid: string;
  name: string;
  tag: string; // empty = no clan
  append: number; // game convention: 0 = prepend, 1 = postpend
}

export interface SetupStatus {
  rootPasswordSet: boolean;
  sourceCount: number;
  vpnSourceSeeded: boolean;
  totalEntries: number;
}

export type Role = "root" | "admin" | "standard";

export interface MeResponse {
  username: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface UserRow {
  id: number;
  username: string;
  role: Role;
  must_change_password: number; // 0 | 1
  created_at: string;
}

export type KeyRequestStatus = "pending" | "approved" | "denied";

export interface KeyRequest {
  id: number;
  name: string;
  role: string; // requested key role, always "server" for now
  status: KeyRequestStatus;
  note: string | null;
  granted_key: string | null; // set when approved (only on the requester's own view)
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  requested_by?: string; // present on the admin/root views
}
