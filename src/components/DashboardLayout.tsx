import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { Moon, Sun, Bell, User, Menu } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

export function DashboardLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const { session, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) {
      void navigate({ to: "/auth", search: { next: pathname } });
    }
  }, [loading, session, navigate, pathname]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar open={open} setOpen={setOpen} />

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(!open)}
              className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground md:hidden"
              aria-label="Toggle navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <Link
              to="/activity"
              className="relative rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Activity"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-destructive" />
            </Link>
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/profile"
              className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Profile"
            >
              <User className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </div>
  );
}
