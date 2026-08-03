import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";
import type { SetupStatus } from "@/lib/types";

export function SetupPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Step 1: root password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  // Step 2: seed VPN list
  const [seedBusy, setSeedBusy] = useState(false);
  const [seededCount, setSeededCount] = useState<number | null>(null);

  useEffect(() => {
    api<SetupStatus>("/api/setup/status")
      .then(setStatus)
      .catch((err) => setLoadError(errorMessage(err)));
  }, []);

  const setRootPassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }
    setPwBusy(true);
    try {
      await api("/api/auth/password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      toast.success("Root password updated");
      const next = await api<SetupStatus>("/api/setup/status");
      setStatus(next);
    } catch (err) {
      setPwError(errorMessage(err));
    } finally {
      setPwBusy(false);
    }
  };

  const seedVpn = async () => {
    setSeedBusy(true);
    try {
      const res = await api<{ ok: boolean; sourceId: number; entryCount: number }>(
        "/api/setup/seed-vpn",
        { method: "POST" }
      );
      setSeededCount(res.entryCount);
      toast.success(`Seeded ${res.entryCount.toLocaleString()} VPN CIDR entries`);
      const next = await api<SetupStatus>("/api/setup/status");
      setStatus(next);
    } catch (err) {
      toast.error(`Seed failed: ${errorMessage(err)}`);
    } finally {
      setSeedBusy(false);
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-destructive">Failed to load setup status: {loadError}</p>
      </div>
    );
  }
  if (!status) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pwDone = status.rootPasswordSet;
  const seedDone = status.vpnSourceSeeded || seededCount !== null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">First-run setup</h1>
        <Button variant="ghost" onClick={() => navigate("/admin")}>
          Skip setup
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {pwDone && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            Step 1 — Root password
          </CardTitle>
          <CardDescription>
            {pwDone ? "Root password is set." : "Set a new password for the root account."}
          </CardDescription>
        </CardHeader>
        {!pwDone && (
          <CardContent>
            <form onSubmit={setRootPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cur">Current password</Label>
                <Input
                  id="cur"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new">New password (min 8 characters)</Label>
                <Input
                  id="new"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              {pwError && <p className="text-sm text-destructive">{pwError}</p>}
              <Button type="submit" disabled={pwBusy}>
                {pwBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set password
              </Button>
            </form>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {seedDone && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            Step 2 — Seed VPN CIDR list
          </CardTitle>
          <CardDescription>
            Fetch the bundled VPN exit-node CIDR list as your first source.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {seededCount !== null && (
            <p className="text-sm">
              Seeded <span className="font-medium">{seededCount.toLocaleString()}</span> entries.
            </p>
          )}
          <Button onClick={seedVpn} disabled={seedBusy}>
            {seedBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {seedDone ? "Re-seed VPN CIDR list" : "Seed VPN CIDR list"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Step 3 — Done</CardTitle>
          <CardDescription>
            {status.sourceCount > 0
              ? `${status.sourceCount} source(s), ${status.totalEntries.toLocaleString()} total entries.`
              : "You can add more CIDR sources at any time."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/">Go to Sources</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
