import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { KeyRevealDialog } from "@/pages/key-reveal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, errorMessage, toastApiError } from "@/lib/api";
import { formatTs } from "@/lib/format";
import type { WzaKey } from "@/lib/types";

function rateSummary(key: WzaKey): string {
  if (key.rate_limit === null) return "unlimited";
  return `${key.rate_limit} / ${key.rate_window_s ?? "?"}s`;
}

/**
 * WZA API Keys view (admin/root): keys that authenticate game servers against
 * generic Wilderzone Auxiliary API functions (e.g. /tribes-api/tag). Kept
 * separate from the whois/VPN keys on purpose - different table, different page.
 */
export function WzaKeysPage() {
  const [keys, setKeys] = useState<WzaKey[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [rateLimit, setRateLimit] = useState("");
  const [rateWindow, setRateWindow] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [revoking, setRevoking] = useState<WzaKey | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ key: string; name: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ keys: WzaKey[] }>("/api/wza-keys");
      setKeys(res.keys);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetCreateForm = () => {
    setName("");
    setRateLimit("");
    setRateWindow("");
    setCreateError(null);
  };

  const createKey = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateBusy(true);
    try {
      const body: Record<string, unknown> = { name };
      if (rateLimit.trim() !== "") body.rateLimit = Number(rateLimit);
      if (rateWindow.trim() !== "") body.rateWindowS = Number(rateWindow);
      const res = await api<{ ok: boolean; key: string; name: string }>("/api/wza-keys", {
        method: "POST",
        body,
      });
      setCreateOpen(false);
      resetCreateForm();
      setRevealedKey({ key: res.key, name: res.name });
      await load();
    } catch (err) {
      if ((err as { status?: number }).status === 403) {
        toastApiError(err, "Create failed");
      } else {
        setCreateError(errorMessage(err));
      }
    } finally {
      setCreateBusy(false);
    }
  };

  const confirmRevoke = async () => {
    if (!revoking) return;
    setRevokeBusy(true);
    try {
      await api(`/api/wza-keys/${revoking.id}`, { method: "DELETE" });
      toast.success(`Revoked ${revoking.name}`);
      setRevoking(null);
      await load();
    } catch (err) {
      toastApiError(err, "Revoke failed");
    } finally {
      setRevokeBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">WZA API Keys</h1>
        <p className="text-destructive">Failed to load: {loadError}</p>
        <Button variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!keys) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">WZA API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Keys for generic Wilderzone Auxiliary API functions (clan tags, etc.). These are
            separate from the Whois/VPN keys.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New key
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Rate limit</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No WZA API keys yet.
              </TableCell>
            </TableRow>
          )}
          {keys.map((k) => (
            <TableRow key={k.id}>
              <TableCell className="font-medium">{k.name}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {k.key.slice(0, 12)}…
              </TableCell>
              <TableCell>{rateSummary(k)}</TableCell>
              <TableCell>{formatTs(k.created_at)}</TableCell>
              <TableCell>{k.last_used_at ? formatTs(k.last_used_at) : "never"}</TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => setRevoking(k)} title="Revoke">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New WZA API Key</DialogTitle>
            <DialogDescription>
              The full key is shown exactly once after creation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void createKey(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wza-key-name">Name</Label>
              <Input
                id="wza-key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wza-key-rate">Rate limit (blank = unlimited)</Label>
                <Input
                  id="wza-key-rate"
                  type="number"
                  min={1}
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wza-key-window">Window (seconds)</Label>
                <Input
                  id="wza-key-window"
                  type="number"
                  min={1}
                  value={rateWindow}
                  onChange={(e) => setRateWindow(e.target.value)}
                  placeholder="3600"
                />
              </div>
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createBusy}>
                {createBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* revoke confirm */}
      <Dialog open={revoking !== null} onOpenChange={(open) => !open && setRevoking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke {revoking?.name}?</DialogTitle>
            <DialogDescription>
              Servers using this key will immediately lose access to WZA API functions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevoking(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmRevoke()} disabled={revokeBusy}>
              {revokeBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <KeyRevealDialog value={revealedKey} onClose={() => setRevealedKey(null)} />
    </div>
  );
}
