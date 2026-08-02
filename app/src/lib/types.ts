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

export interface SetupStatus {
  rootPasswordSet: boolean;
  sourceCount: number;
  vpnSourceSeeded: boolean;
  totalEntries: number;
}

export interface MeResponse {
  username: string;
  mustChangePassword: boolean;
}
