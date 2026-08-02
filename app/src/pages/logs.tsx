import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, errorMessage } from "@/lib/api";
import { formatTs } from "@/lib/format";
import type { LogRow } from "@/lib/types";

const PAGE_SIZE = 100;
const AUTO_REFRESH_MS = 30_000;

interface LogsResponse {
  total: number;
  offset: number;
  limit: number;
  rows: LogRow[];
}

export function LogsPage() {
  const [flaggedOnly, setFlaggedOnly] = useState(true);
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(PAGE_SIZE),
          q: submittedQ,
        });
        if (flaggedOnly) params.set("flagged", "1");
        const res = await api<LogsResponse>(`/api/logs?${params}`);
        setData(res);
      } catch (err) {
        if (!silent) toast.error(`Failed to load logs: ${errorMessage(err)}`);
      } finally {
        setLoading(false);
      }
    },
    [offset, submittedQ, flaggedOnly]
  );

  // Reset pagination when filters change.
  useEffect(() => {
    setOffset(0);
  }, [flaggedOnly, submittedQ]);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-refresh every 30s.
  useEffect(() => {
    const id = setInterval(() => void load(true), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Query Log</h1>
        <span className="text-xs text-muted-foreground">Rolling 48h · auto-refreshes every 30s</span>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2 pb-2">
          <Switch
            id="flagged-only"
            checked={flaggedOnly}
            onCheckedChange={setFlaggedOnly}
          />
          <Label htmlFor="flagged-only">Flagged only</Label>
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmittedQ(q.trim());
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="logs-q">Search</Label>
            <Input
              id="logs-q"
              placeholder="Player name or GUID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-64"
            />
          </div>
          <Button type="submit" variant="outline">
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
        </form>
      </div>

      {loading && !data ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          No log rows match.
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {data.total.toLocaleString()} row(s)
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>GUID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>VPN detail</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Geo</TableHead>
                <TableHead>ISP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">{formatTs(row.ts)}</TableCell>
                  <TableCell className="font-medium">{row.player_name}</TableCell>
                  <TableCell className="font-mono text-xs">{row.guid}</TableCell>
                  <TableCell>
                    {row.flagged === 1 ? (
                      <Badge variant="destructive">VPN</Badge>
                    ) : (
                      <Badge className="border-transparent bg-green-600 text-white hover:bg-green-600/80">
                        clean
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48">
                    {row.vpn_detail ? (
                      <span className="block truncate text-sm" title={row.vpn_detail}>
                        {row.vpn_detail}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.ip ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>{row.geo ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="max-w-40">
                    {row.isp ? (
                      <span className="block truncate text-sm" title={row.isp}>
                        {row.isp}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {page} of {pageCount}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + PAGE_SIZE >= data.total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
