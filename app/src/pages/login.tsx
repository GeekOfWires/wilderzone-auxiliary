import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { MeResponse, SetupStatus } from "@/lib/types";

export function LoginPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already authenticated (and not forced to change password) → skip login.
  if (user) {
    return <Navigate to={user.mustChangePassword ? "/account" : "/"} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api<{ ok: boolean; username: string; mustChangePassword: boolean }>(
        "/api/auth/login",
        { method: "POST", body: { username, password } }
      );
      // The login response has no role — fetch the full session profile.
      const me = await api<MeResponse>("/api/auth/me");
      setUser(me);
      if (me.mustChangePassword) {
        navigate("/account", { replace: true });
        return;
      }
      // First run? Admins route into the setup wizard when no sources exist yet.
      // (setup endpoints are admin-only, so standard users skip this check.)
      if (me.role !== "standard") {
        const status = await api<SetupStatus>("/api/setup/status");
        navigate(status.sourceCount === 0 ? "/setup" : "/", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex justify-center">
            <img src="/admin/wilderzone_aux.svg" alt="Wilderzone Auxiliary" className="h-10" />
          </div>
          <CardDescription className="text-center">Sign in to Wilderzone Auxiliary</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
