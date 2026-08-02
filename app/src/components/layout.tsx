import {
  KeyRound,
  ListFilter,
  Loader2,
  LogOut,
  ScrollText,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof ListFilter;
  end: boolean;
  /** roles that see this entry */
  roles: Role[];
}

const ALL: Role[] = ["root", "admin", "standard"];
const ADMINS: Role[] = ["root", "admin"];

const NAV: NavItem[] = [
  { to: "/", label: "Sources", icon: ListFilter, end: true, roles: ALL },
  { to: "/entries", label: "Entries", icon: ScrollText, end: false, roles: ALL },
  { to: "/keys", label: "API Keys", icon: KeyRound, end: false, roles: ALL },
  { to: "/logs", label: "Query Log", icon: ShieldCheck, end: false, roles: ADMINS },
  { to: "/users", label: "Users", icon: Users, end: false, roles: ["root"] },
  { to: "/account", label: "Account", icon: User, end: false, roles: ALL },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (user === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (user === null) {
    return <Navigate to="/login" replace />;
  }
  // Forced password change: block all other navigation until done.
  if (user.mustChangePassword && location.pathname !== "/account") {
    return <Navigate to="/account" replace />;
  }

  // Role gating: keep users off pages their role can't use (backend 403s anyway).
  const roleHome: Record<Role, string[]> = {
    root: NAV.map((n) => n.to),
    admin: NAV.filter((n) => n.roles.includes("admin")).map((n) => n.to),
    standard: NAV.filter((n) => n.roles.includes("standard")).map((n) => n.to),
  };
  const allowed = roleHome[user.role];
  const pathAllowed =
    allowed.some((to) => (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to))) ||
    location.pathname === "/setup"; // setup wizard is admin-only but not in nav; guard below
  if (!pathAllowed || (location.pathname === "/setup" && user.role === "standard")) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <img src="/admin/wilderzone_aux.svg" alt="Wilderzone Auxiliary" className="h-8" />
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {NAV.filter((item) => item.roles.includes(user.role)).map(
            ({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            )
          )}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.username}</span>
            <Badge variant={user.role === "standard" ? "secondary" : "default"}>{user.role}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
