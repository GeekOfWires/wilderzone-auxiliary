// cidr.ts - CIDR parsing (pluggable format mappings) and fast IP lookup.

export interface SourceFormat {
  type: "cidr-lines" | "ip-lines" | "csv" | "json";
  skipPrefix?: string;   // cidr-lines / ip-lines: comment marker
  ipColumn?: number;     // csv: index of column holding IP or CIDR
  cidrColumn?: number;   // csv: index of column holding CIDR (wins over ipColumn)
  delimiter?: string;    // csv: default ","
  hasHeader?: boolean;   // csv: skip first line
  path?: string;         // json: e.g. "items[*].ip" or "[*]"
}

export interface SourceRow {
  id: number;
  name: string;
  url: string;
  format: string; // JSON string of SourceFormat
  enabled: number;
  last_fetched_at: string | null;
  entry_count: number;
  last_error: string | null;
}

// ---------------------------------------------------------------------------
// IP math
// ---------------------------------------------------------------------------

export function ipToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const o = parseInt(p, 10);
    if (o > 255) return null;
    n = n * 256 + o;
  }
  // keep in signed 32-bit range semantics via >>> 0
  return n >>> 0;
}

export function isPrivateIp(ip: string): boolean {
  const n = ipToInt(ip);
  if (n === null) return true;
  const a = n >>> 24;
  const b = (n >>> 16) & 255;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function cidrToRange(cidr: string): [number, number] | null {
  const slash = cidr.indexOf("/");
  let ip = cidr;
  let bits = 32;
  if (slash >= 0) {
    ip = cidr.slice(0, slash);
    bits = parseInt(cidr.slice(slash + 1), 10);
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  }
  const start = ipToInt(ip.trim());
  if (start === null) return null;
  const size = bits === 0 ? 4294967296 : 2 ** (32 - bits);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  const net = (start & mask) >>> 0;
  return [net, (net + size - 1) >>> 0];
}

// ---------------------------------------------------------------------------
// Format-mapping parsers: raw body -> normalized CIDR list (one per line)
// ---------------------------------------------------------------------------

export function parseSourceBody(body: string, format: SourceFormat): string[] {
  switch (format.type) {
    case "cidr-lines":
      return parseLines(body, format.skipPrefix ?? "#", false);
    case "ip-lines":
      return parseLines(body, format.skipPrefix ?? "#", true);
    case "csv":
      return parseCsv(body, format);
    case "json":
      return parseJsonList(body, format);
    default:
      throw new Error(`unknown source format type: ${(format as SourceFormat).type}`);
  }
}

function parseLines(body: string, skipPrefix: string, bareIps: boolean): string[] {
  const out: string[] = [];
  for (let line of body.split("\n")) {
    line = line.trim();
    if (line === "" || (skipPrefix !== "" && line.startsWith(skipPrefix))) continue;
    const cidr = bareIps ? line + "/32" : line;
    if (cidrToRange(cidr)) out.push(cidr);
  }
  return out;
}

function parseCsv(body: string, format: SourceFormat): string[] {
  const delim = format.delimiter ?? ",";
  const out: string[] = [];
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i === 0 && format.hasHeader) continue;
    const line = lines[i].trim();
    if (line === "") continue;
    const cols = line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
    let cidr = "";
    if (format.cidrColumn !== undefined && cols[format.cidrColumn]) {
      cidr = cols[format.cidrColumn];
      if (!cidr.includes("/")) cidr += "/32";
    } else if (format.ipColumn !== undefined && cols[format.ipColumn]) {
      cidr = cols[format.ipColumn] + "/32";
    }
    if (cidr && cidrToRange(cidr)) out.push(cidr);
  }
  return out;
}

// minimal "[*].field" / "path[*].field" evaluator for JSON arrays
function parseJsonList(body: string, format: SourceFormat): string[] {
  const data = JSON.parse(body);
  const path = format.path ?? "[*]";
  const m = /^(.*?)\[\*\](?:\.(.+))?$/.exec(path);
  if (!m) throw new Error(`unsupported json path: ${path}`);
  const base = m[1] ? getPath(data, m[1]) : data;
  const field = m[2];
  if (!Array.isArray(base)) throw new Error(`json path ${path} did not resolve to an array`);
  const out: string[] = [];
  for (const item of base) {
    let v: unknown = item;
    if (field) v = getPath(item, field);
    if (typeof v === "string") {
      const cidr = v.includes("/") ? v : v + "/32";
      if (cidrToRange(cidr)) out.push(cidr);
    }
  }
  return out;
}

function getPath(obj: unknown, path: string): unknown {
  let cur = obj;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

// ---------------------------------------------------------------------------
// Merged searchable set, built per isolate from normalized CIDR text
// ---------------------------------------------------------------------------

export interface BuiltSet {
  // sorted by network start; parallel arrays
  starts: number[];
  ends: number[];
  sources: number[]; // index into names
  cidrs: string[];
  names: string[];
}

export function buildSet(perSource: { name: string; body: string }[]): BuiltSet {
  const starts: number[] = [];
  const ends: number[] = [];
  const sources: number[] = [];
  const cidrs: string[] = [];
  const names: string[] = [];

  perSource.forEach(({ name, body }, si) => {
    names.push(name);
    for (const line of body.split("\n")) {
      const cidr = line.trim();
      if (!cidr) continue;
      const range = cidrToRange(cidr);
      if (!range) continue;
      starts.push(range[0]);
      ends.push(range[1]);
      sources.push(si);
      cidrs.push(cidr);
    }
  });

  // sort parallel arrays by start
  const order = starts.map((_, i) => i).sort((a, b) => starts[a] - starts[b]);
  return {
    starts: order.map((i) => starts[i]),
    ends: order.map((i) => ends[i]),
    sources: order.map((i) => sources[i]),
    cidrs: order.map((i) => cidrs[i]),
    names,
  };
}

// binary search: is ip inside any range? returns matched source + cidr
export function lookup(set: BuiltSet, ip: string): { source: string; cidr: string } | null {
  const n = ipToInt(ip);
  if (n === null) return null;

  const { starts, ends, sources, cidrs, names } = set;
  let lo = 0;
  let hi = starts.length - 1;
  let candidate = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (starts[mid] <= n) {
      candidate = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  // ranges are sorted by start; only ranges with start <= n can contain it.
  // walk backwards over those (few in practice - CIDR lists barely overlap)
  for (let i = candidate; i >= 0; i--) {
    if (n <= ends[i]) return { source: names[sources[i]], cidr: cidrs[i] };
  }
  return null;
}
