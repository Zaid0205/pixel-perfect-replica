import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  DollarSign,
  CreditCard,
  Activity,
  User,
  Settings,
  ChevronsRight,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type NavItem = { title: string; url: string; icon: LucideIcon };

const mainItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Sales", url: "/sales", icon: DollarSign },
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "Activity Log", url: "/activity", icon: Activity },
  { title: "Profile", url: "/profile", icon: User },
];

function Logo() {
  return (
    <div className="grid size-10 shrink-0 place-content-center rounded-lg bg-primary shadow-sm">
      <svg
        width="20"
        height="auto"
        viewBox="0 0 50 39"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="fill-primary-foreground"
      >
        <path d="M16.4992 2H37.5808L22.0816 24.9729H1L16.4992 2Z" />
        <path d="M17.4224 27.102L11.4192 36H33.5008L49 13.0271H32.7024L23.2064 27.102H17.4224Z" />
      </svg>
    </div>
  );
}

function Option({ item, open }: { item: NavItem; open: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isSelected = pathname === item.url;
  const Icon = item.icon;

  return (
    <Link
      to={item.url}
      title={item.title}
      className={`relative flex h-11 w-full items-center rounded-md transition-all duration-200 ${
        isSelected
          ? "border-l-2 border-primary bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <div className="grid h-full w-12 place-content-center">
        <Icon className="h-4 w-4" />
      </div>
      {open && <span className="text-sm font-medium">{item.title}</span>}
    </Link>
  );
}

export function AppSidebar({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { profile, role, signOut } = useAuth();

  return (
    <nav
      className={`sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border bg-sidebar p-2 shadow-sm transition-all duration-300 ease-in-out md:block ${
        open ? "w-64" : "w-16"
      }`}
    >
      <div className="mb-6 border-b border-sidebar-border pb-4">
        <div className="flex items-center gap-3 rounded-md p-2">
          <Logo />
          {open && (
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">
                Osaka Distribution
              </span>
              <span className="block text-xs capitalize text-muted-foreground">
                {role ?? "member"} · {profile?.full_name ?? "—"}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mb-8 space-y-1">
        {mainItems.map((item) => (
          <Option key={item.url} item={item} open={open} />
        ))}
      </div>

      <div className="space-y-1 border-t border-sidebar-border pt-4">
        {open && (
          <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Account
          </div>
        )}
        <Option item={{ title: "Settings", url: "/settings", icon: Settings }} open={open} />
        <button
          onClick={() => void signOut()}
          title="Sign out"
          className="relative flex h-11 w-full items-center rounded-md text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
        >
          <div className="grid h-full w-12 place-content-center">
            <LogOut className="h-4 w-4" />
          </div>
          {open && <span className="text-sm font-medium">Sign out</span>}
        </button>
      </div>

      <button
        onClick={() => setOpen(!open)}
        className="absolute bottom-0 left-0 right-0 border-t border-sidebar-border transition-colors hover:bg-muted"
      >
        <div className="flex items-center p-3">
          <div className="grid size-10 place-content-center">
            <ChevronsRight
              className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${
                open ? "rotate-180" : ""
              }`}
            />
          </div>
          {open && <span className="text-sm font-medium text-muted-foreground">Hide</span>}
        </div>
      </button>
    </nav>
  );
}
