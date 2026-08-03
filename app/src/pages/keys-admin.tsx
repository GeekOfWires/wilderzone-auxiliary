import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { KeyRevealDialog } from "@/pages/key-reveal";
import { StatusBadge } from "@/pages/keys-standard";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errorMessage, toastApiError } from "@/lib/api";
import { formatTs } from "@/lib/format";
import type { ApiKey, KeyRequest } from "@/lib/types";
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

/** API Keys view for admin/root: full key management plus request review. */
export function KeysAdminPage() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [requests, setRequests] = useState<KeyRequest[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("public");
  const [rateLimit, setRateLimit] = useState("");
  const [rateWindow, setRateWindow] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const [revealedKey, setRevealedKey] = useState<{ key: string; name: string } | null>(null);

  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const [denying, setDenying] = useState<KeyRequest | null>(null);
  const [denyNote, setDenyNote] = useState("");
  const [reviewBusyId, setReviewBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [keysRes, reqRes] = await Promise.all([
        api<{ keys: ApiKey[] }>("/api/keys"),
        api<{ requests: KeyRequest[] }>("/api/keys/requests"),
      ]);
      setKeys(keysRes.keys);
      setRequests(reqRes.requests);
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
      await api(`/api/keys/${revoking.id}`, { method: "DELETE" });
      toast.success(`Revoked ${revoking.name}`);
      setRevoking(null);
      await load();
    } catch (err) {
      toastApiError(err, "Revoke failed");
    } finally {
      setRevokeBusy(false);
    }
  };

  const approve = async (request: KeyRequest) => {
    setReviewBusyId(request.id);
    try {
      const res = await api<{ ok: boolean; key: string; name: string; role: string }>(
        `/api/keys/requests/${request.id}/approve`,
        { method: "POST" }
      );
      setRevealedKey({ key: res.key, name: res.name });
      await load();
    } catch (err) {
      toastApiError(err, "Approve failed");
    } finally {
      setReviewBusyId(null);
    }
  };

  const confirmDeny = async () => {
    if (!denying) return;
    setReviewBusyId(denying.id);
    try {
      await api(`/api/keys/requests/${denying.id}/deny`, {
        method: "POST",
        body: denyNote.trim() ? { note: denyNote.trim() } : {},
      });
      toast.success(`Denied request "${denying.name}"`);
      setDenying(null);
      setDenyNote("");
      await load();
    } catch (err) {
      toastApiError(err, "Deny failed");
    } finally {
      setReviewBusyId(null);
    }
  };

  if (loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Whois API Keys</h1>
        <p className="text-destructive">Failed to load: {loadError}</p>
        <Button variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!keys || !requests) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === "pending");
  const reviewed = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Whois API Keys</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create key
        </Button>
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">Keys</TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            {pending.length > 0 && (
              <Badge variant="destructive" className="ml-2 px-1.5">
                {pending.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="mt-4">
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
                        <span className="ml-1 text-xs text-muted-foreground">
                          by {k.created_by}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {!revoked && (
                          <Button variant="ghost" size="sm" onClick={() => setRevoking(k)}>
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
        </TabsContent>

        <TabsContent value="requests" className="mt-4 space-y-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Pending</h2>
            {pending.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
                No pending requests.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Requested by</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.requested_by ?? "—"}</TableCell>
                      <TableCell className="max-w-56">
                        {r.note ? (
                          <span className="block truncate text-sm" title={r.note}>
                            {r.note}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatTs(r.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={reviewBusyId === r.id}
                            onClick={() => void approve(r)}
                          >
                            {reviewBusyId === r.id ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="mr-1 h-4 w-4 text-green-600" />
                            )}
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={reviewBusyId === r.id}
                            onClick={() => {
                              setDenyNote("");
                              setDenying(r);
                            }}
                          >
                            <X className="mr-1 h-4 w-4 text-destructive" />
                            Deny
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">History</h2>
            {reviewed.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
                No reviewed requests yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Requested by</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Reviewed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewed.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.requested_by ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="max-w-56">
                        {r.note ? (
                          <span className="block truncate text-sm" title={r.note}>
                            {r.note}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTs(r.reviewed_at)}
                        {r.reviewed_by && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            by {r.reviewed_by}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

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

      {/* Copy-once dialog for freshly minted keys (create or approve) */}
      <KeyRevealDialog value={revealedKey} onClose={() => setRevealedKey(null)} />

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

      {/* Deny request dialog */}
      <Dialog open={denying !== null} onOpenChange={(open) => !open && setDenying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny request</DialogTitle>
            <DialogDescription>
              Deny the key request <span className="font-medium">"{denying?.name}"</span> from{" "}
              {denying?.requested_by ?? "unknown"}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="deny-note">Note (optional)</Label>
            <Input
              id="deny-note"
              placeholder="Reason for denial…"
              value={denyNote}
              onChange={(e) => setDenyNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenying(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reviewBusyId === denying?.id}
              onClick={() => void confirmDeny()}
            >
              {reviewBusyId === denying?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deny request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
