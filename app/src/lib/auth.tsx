import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import type { MeResponse } from "@/lib/types";

interface AuthState {
  /** null while the initial /api/auth/me check is in flight */
  user: MeResponse | null | undefined;
  refresh: () => Promise<void>;
  setUser: (user: MeResponse | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const me = await api<MeResponse>("/api/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      window.location.assign("/login");
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, refresh, setUser, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
