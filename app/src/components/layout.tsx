import { KeyRound, ListFilter, Loader2, LogOut, ScrollText, ShieldCheck, User } from "lucide-react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Sources", icon: ListFilter, end: true },
  { to: "/entries", label: "Entries", icon: ScrollText, end: false },
  { to: "/keys", label: "API Keys", icon: KeyRound, end: false },
  { to: "/logs", label: "Query Log", icon: ShieldCheck, end: false },
  { to: "/account", label: "Account", icon: User, end: false },
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

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
        <div className="flex h-14 items-center border-b px-4 font-semibold">TPC Admin</div>
        <nav className="flex-1 space-y-1 p-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
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
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <div className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.username}</span>
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
