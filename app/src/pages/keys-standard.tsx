import { Check, Copy, Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { ApiKey, KeyRequest, KeyRequestStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: KeyRequestStatus }) {
  if (status === "approved") {
    return (
      <Badge className="border-transparent bg-green-600 text-white hover:bg-green-600/80">
        approved
      </Badge>
    );
  }
  if (status === "denied") return <Badge variant="destructive">denied</Badge>;
  return <Badge variant="secondary">pending</Badge>;
}

function CopyKeyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Key copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — select and copy the key manually");
    }
  };
  return (
    <Button variant="outline" size="icon" onClick={() => void copy()} title="Copy key">
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

/** API Keys view for standard users: public key, request a key, track own requests. */
export function KeysStandardPage() {
  const [publicKeys, setPublicKeys] = useState<ApiKey[] | null>(null);
  const [requests, setRequests] = useState<KeyRequest[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [requestOpen, setRequestOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [keysRes, reqRes] = await Promise.all([
        api<{ keys: ApiKey[] }>("/api/keys"),
        api<{ requests: KeyRequest[] }>("/api/keys/requests/mine"),
      ]);
      setPublicKeys(keysRes.keys.filter((k) => k.role === "public"));
      setRequests(reqRes.requests);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitRequest = async (e: FormEvent) => {
    e.preventDefault();
    setRequestError(null);
    setRequestBusy(true);
    try {
      await api("/api/keys/requests", {
        method: "POST",
        body: { name, ...(note.trim() ? { note: note.trim() } : {}) },
      });
      toast.success("Request submitted — an admin will review it");
      setRequestOpen(false);
      setName("");
      setNote("");
      await load();
    } catch (err) {
      if ((err as { status?: number }).status === 403) {
        toastApiError(err, "Request failed");
      } else {
        setRequestError(errorMessage(err));
      }
    } finally {
      setRequestBusy(false);
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

  if (!publicKeys || !requests) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Whois API Keys</h1>
        <Button onClick={() => setRequestOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Request API key
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Public key</CardTitle>
          <CardDescription>
            Rate-limited by the service — free for every user to view and use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {publicKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No public key is configured.</p>
          ) : (
            publicKeys.map((k) => (
              <div key={k.id} className="flex items-center gap-2">
                <div className="min-w-28 text-sm font-medium">{k.name}</div>
                <code className="flex-1 break-all rounded-md bg-muted p-3 font-mono text-sm">
                  {k.key}
                </code>
                <CopyKeyButton value={k.key} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">My requests</h2>
        {requests.length === 0 ? (
          <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
            No key requests yet. Request a server key and an admin will review it.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Reviewed</TableHead>
                <TableHead>Key</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.name}
                    {r.note && (
                      <div className="max-w-64 truncate text-xs text-muted-foreground" title={r.note}>
                        {r.note}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatTs(r.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.reviewed_by ? (
                      <>
                        {formatTs(r.reviewed_at)}
                        <span className="ml-1 text-xs text-muted-foreground">
                          by {r.reviewed_by}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.status === "approved" && r.granted_key ? (
                      <div className="flex items-center gap-2">
                        <code className="break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                          {r.granted_key}
                        </code>
                        <CopyKeyButton value={r.granted_key} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request API key</DialogTitle>
            <DialogDescription>
              Requests a server-role key. An admin or root user will approve or deny it.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRequest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="req-name">Name</Label>
              <Input
                id="req-name"
                placeholder="e.g. My game server"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-note">Note (optional)</Label>
              <Input
                id="req-note"
                placeholder="What is this key for?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {requestError && <p className="text-sm text-destructive">{requestError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRequestOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={requestBusy}>
                {requestBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
