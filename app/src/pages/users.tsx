import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { api, errorMessage, toastApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatTs } from "@/lib/format";
import type { UserRow } from "@/lib/types";

const ROLE_VARIANT: Record<UserRow["role"], "default" | "secondary" | "destructive" | "outline"> = {
  root: "destructive",
  admin: "default",
  standard: "secondary",
};

/** User management — root only. */
export function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "standard">("standard");
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ users: UserRow[] }>("/api/users");
      setUsers(res.users);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (user?.role === "root") void load();
  }, [load, user?.role]);

  if (user && user.role !== "root") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-muted-foreground">Only the root account can manage users.</p>
      </div>
    );
  }

  const addUser = async (e: FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (password.length < 8) {
      setAddError("Password must be at least 8 characters.");
      return;
    }
    setAddBusy(true);
    try {
      await api("/api/users", { method: "POST", body: { username, password, role } });
      toast.success(`User ${username} created`);
      setAddOpen(false);
      setUsername("");
      setPassword("");
      setRole("standard");
      await load();
    } catch (err) {
      if ((err as { status?: number }).status === 403) {
        toastApiError(err, "Add user failed");
      } else {
        setAddError(errorMessage(err)); // includes 409 "username already taken"
      }
    } finally {
      setAddBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/users/${deleting.id}`, { method: "DELETE" });
      toast.success(`Removed ${deleting.username}`);
      setDeleting(null);
      await load();
    } catch (err) {
      toastApiError(err, "Remove user failed");
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-destructive">Failed to load users: {loadError}</p>
        <Button variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!users) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add user
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            const canDelete = u.role !== "root" && u.username !== user?.username;
            return (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  {u.username}
                  {u.username === user?.username && (
                    <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                  )}
                  {u.must_change_password === 1 && (
                    <span className="ml-2 text-xs text-amber-600">must change password</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={ROLE_VARIANT[u.role] ?? "outline"}>{u.role}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatTs(u.created_at)}</TableCell>
                <TableCell className="text-right">
                  {canDelete && (
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(u)}>
                      <Trash2 className="mr-1 h-4 w-4 text-destructive" />
                      Remove
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Add user dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              The new user will be required to change their password on first login.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={addUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Username</Label>
              <Input
                id="user-name"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-pass">Temporary password (min 8 characters)</Label>
              <Input
                id="user-pass"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "standard")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">standard</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {addError && <p className="text-sm text-destructive">{addError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addBusy}>
                {addBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add user
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove user</DialogTitle>
            <DialogDescription>
              Remove <span className="font-medium">{deleting?.username}</span>? They will no longer
              be able to sign in. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleteBusy} onClick={() => void confirmDelete()}>
              {deleteBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
