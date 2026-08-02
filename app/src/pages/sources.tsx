import { Loader2, Pencil, Plus, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { SourceEditorDialog } from "@/pages/source-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { Source, SourceFormat } from "@/lib/types";

function formatSummary(formatJson: string): string {
  try {
    const fmt = JSON.parse(formatJson) as SourceFormat;
    return fmt.type;
  } catch {
    return "unknown";
  }
}

export function SourcesPage() {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Source | null>(null);
  const [deleting, setDeleting] = useState<Source | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ sources: Source[] }>("/api/sources");
      setSources(res.sources);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleEnabled = async (source: Source, enabled: boolean) => {
    setTogglingId(source.id);
    // Optimistic update
    setSources((prev) =>
      prev ? prev.map((s) => (s.id === source.id ? { ...s, enabled: enabled ? 1 : 0 } : s)) : prev
    );
    try {
      await api(`/api/sources/${source.id}`, { method: "PUT", body: { enabled } });
    } catch (err) {
      toast.error(`Failed to update ${source.name}: ${errorMessage(err)}`);
      await load();
    } finally {
      setTogglingId(null);
    }
  };

  const refreshNow = async (source: Source) => {
    setRefreshingId(source.id);
    try {
      const res = await api<{ ok: boolean; entryCount: number }>(
        `/api/sources/${source.id}/refresh`,
        { method: "POST" }
      );
      toast.success(`${source.name}: ${res.entryCount.toLocaleString()} entries`);
      await load();
    } catch (err) {
      toast.error(`Refresh failed for ${source.name}: ${errorMessage(err)}`);
      await load(); // pick up last_error
    } finally {
      setRefreshingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/sources/${deleting.id}`, { method: "DELETE" });
      toast.success(`Deleted ${deleting.name}`);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(`Delete failed: ${errorMessage(err)}`);
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Sources</h1>
        <p className="text-destructive">Failed to load sources: {loadError}</p>
        <Button variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!sources) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sources</h1>
        <div className="flex gap-2">
          {sources.length === 0 && (
            <Button variant="outline" asChild>
              <Link to="/setup">
                <Wand2 className="mr-2 h-4 w-4" />
                Run setup
              </Link>
            </Button>
          )}
          <Button
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add source
          </Button>
        </div>
      </div>

      {sources.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          No sources yet. Add one manually or run the setup wizard to seed the VPN list.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead className="text-right">Entries</TableHead>
              <TableHead>Last fetched</TableHead>
              <TableHead>Last error</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-medium">{s.name}</div>
                  <div className="max-w-64 truncate text-xs text-muted-foreground">{s.url}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{formatSummary(s.format)}</Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={s.enabled === 1}
                    disabled={togglingId === s.id}
                    onCheckedChange={(v) => void toggleEnabled(s, v)}
                    aria-label={`Enable ${s.name}`}
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.entry_count.toLocaleString()}
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatTs(s.last_fetched_at)}</TableCell>
                <TableCell>
                  {s.last_error ? (
                    <span className="text-sm text-destructive">{s.last_error}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Refresh now"
                      disabled={refreshingId === s.id}
                      onClick={() => void refreshNow(s)}
                    >
                      {refreshingId === s.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit"
                      onClick={() => {
                        setEditing(s);
                        setEditorOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      onClick={() => setDeleting(s)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <SourceEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        source={editing}
        onSaved={() => void load()}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete source</DialogTitle>
            <DialogDescription>
              Delete <span className="font-medium">{deleting?.name}</span> and all of its entries?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleteBusy} onClick={() => void confirmDelete()}>
              {deleteBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
