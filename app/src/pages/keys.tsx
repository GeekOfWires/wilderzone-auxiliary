import { Check, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
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
import { formatTs } from "@/lib/format";
import type { ApiKey } from "@/lib/types";
import { cn } from "@/lib/utils";

type Role = ApiKey["role"];

const ROLE_VARIANT: Record<Role, "default" | "secondary" | "destructive" | "outline"> = {
  public: "secondary",
  server: "default",
  admin: "destructive",
};

function rateSummary(key: ApiKey): string {
  if (key.rate_limit === null) return "unlimited";
  return `${key.rate_limit} / ${key.rate_window_s ?? "?"}s`;
}

export function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("public");
  const [rateLimit, setRateLimit] = useState("");
  const [rateWindow, setRateWindow] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const [createdKey, setCreatedKey] = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ keys: ApiKey[] }>("/api/keys");
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
    setRole("public");
    setRateLimit("");
    setRateWindow("");
    setCreateError(null);
  };

  const createKey = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateBusy(true);
    try {
      const body: Record<string, unknown> = { name, role };
      if (rateLimit.trim() !== "") body.rateLimit = Number(rateLimit);
      if (rateWindow.trim() !== "") body.rateWindowS = Number(rateWindow);
      const res = await api<{ ok: boolean; key: string; name: string; role: string }>(
        "/api/keys",
        { method: "POST", body }
      );
      setCreateOpen(false);
      resetCreateForm();
      setCopied(false);
      setCreatedKey({ key: res.key, name: res.name });
      await load();
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreateBusy(false);
    }
  };

  const copyKey = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      toast.success("Key copied to clipboard");
    } catch {
      toast.error("Copy failed — select and copy the key manually");
    }
  };

  const confirmRevoke = async () => {
    if (!revoking) return;
    setRevokeBusy(true);
    try {
      await api(`/api/keys/${revoking.id}`, { method: "DELETE" });
      toast.success(`Revoked ${revoking.name}`);
      setRevoking(null);
      await load();
    } catch (err) {
      toast.error(`Revoke failed: ${errorMessage(err)}`);
    } finally {
      setRevokeBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <p className="text-destructive">Failed to load keys: {loadError}</p>
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
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create key
        </Button>
      </div>

      {keys.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          No API keys yet.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Rate limit</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((k) => {
              const revoked = k.revoked_at !== null;
              return (
                <TableRow key={k.id} className={cn(revoked && "opacity-50")}>
                  <TableCell className="font-medium">
                    {k.name}
                    {revoked && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (revoked {formatTs(k.revoked_at)})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROLE_VARIANT[k.role] ?? "outline"}>{k.role}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{rateSummary(k)}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatTs(k.last_used_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatTs(k.created_at)}
                    <span className="ml-1 text-xs text-muted-foreground">by {k.created_by}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {!revoked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevoking(k)}
                      >
                        <Trash2 className="mr-1 h-4 w-4 text-destructive" />
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Create key dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              The full key is shown once, immediately after creation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createKey} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">public</SelectItem>
                  <SelectItem value="server">server</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="key-rate">Rate limit (optional)</Label>
                <Input
                  id="key-rate"
                  type="number"
                  min={1}
                  placeholder="unlimited"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key-window">Window seconds (optional)</Label>
                <Input
                  id="key-window"
                  type="number"
                  min={1}
                  placeholder="3600"
                  value={rateWindow}
                  onChange={(e) => setRateWindow(e.target.value)}
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

      {/* Show-once key dialog */}
      <Dialog
        open={createdKey !== null}
        onOpenChange={(open) => {
          if (!open) setCreatedKey(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Key created: {createdKey?.name}</DialogTitle>
            <DialogDescription>
              Copy this key now. It will <span className="font-semibold">not</span> be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded-md bg-muted p-3 font-mono text-sm">
              {createdKey?.key}
            </code>
            <Button variant="outline" size="icon" onClick={() => void copyKey()} title="Copy key">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm dialog */}
      <Dialog open={revoking !== null} onOpenChange={(open) => !open && setRevoking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke key</DialogTitle>
            <DialogDescription>
              Revoke <span className="font-medium">{revoking?.name}</span>? Any client using this key
              will immediately lose access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevoking(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={revokeBusy} onClick={() => void confirmRevoke()}>
              {revokeBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
