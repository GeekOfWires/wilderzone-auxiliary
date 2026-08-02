import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, errorMessage } from "@/lib/api";
import type { Source } from "@/lib/types";

const PAGE_SIZE = 50;

interface EntriesResponse {
  total: number;
  filtered: number;
  offset: number;
  limit: number;
  entries: string[];
}

export function EntriesPage() {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [sourceId, setSourceId] = useState<string>("");
  const [q, setQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<EntriesResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ sources: Source[] }>("/api/sources")
      .then((res) => {
        setSources(res.sources);
        if (res.sources.length > 0) setSourceId(String(res.sources[0].id));
      })
      .catch((err) => toast.error(`Failed to load sources: ${errorMessage(err)}`));
  }, []);

  const loadEntries = useCallback(async () => {
    if (!sourceId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(PAGE_SIZE),
        q: submittedQ,
      });
      const res = await api<EntriesResponse>(`/api/sources/${sourceId}/entries?${params}`);
      setData(res);
    } catch (err) {
      toast.error(`Failed to load entries: ${errorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }, [sourceId, offset, submittedQ]);

  useEffect(() => {
    setOffset(0);
    setData(null);
  }, [sourceId, submittedQ]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  if (sources === null) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Entries</h1>
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          No sources configured yet.
        </div>
      </div>
    );
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = data ? Math.max(1, Math.ceil(data.filtered / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Entries</h1>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-64 space-y-2">
          <Label>Source</Label>
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a source" />
            </SelectTrigger>
            <SelectContent>
              {sources.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmittedQ(q.trim());
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="entries-q">Search</Label>
            <Input
              id="entries-q"
              placeholder="Filter CIDRs…"
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

      {data && (
        <p className="text-sm text-muted-foreground">
          Showing {data.filtered.toLocaleString()} of {data.total.toLocaleString()} entries
          {submittedQ && ` matching "${submittedQ}"`}
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">#</TableHead>
            <TableHead>CIDR</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && !data ? (
            <TableRow>
              <TableCell colSpan={2} className="text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
              </TableCell>
            </TableRow>
          ) : data && data.entries.length > 0 ? (
            data.entries.map((entry, i) => (
              <TableRow key={`${offset + i}-${entry}`}>
                <TableCell className="tabular-nums text-muted-foreground">
                  {offset + i + 1}
                </TableCell>
                <TableCell className="font-mono text-sm">{entry}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
                {data ? "No entries match." : "—"}
              </TableCell>
            </TableRow>
          )}
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
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data || offset + PAGE_SIZE >= data.filtered || loading}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
