import { Link } from "@tanstack/react-router";
import { Home, DollarSign, CreditCard, Activity, Settings } from "lucide-react";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Sales", url: "/sales", icon: DollarSign },
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "Activity", url: "/activity", icon: Activity },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function MobileNav() {
  return (
    <div className="sticky bottom-0 z-10 mt-8 flex items-center justify-around border-t border-border bg-card py-2 md:hidden">
      {items.map((item) => (
        <Link
          key={item.url}
          to={item.url}
          className="flex flex-col items-center gap-1 px-2 py-1 text-xs text-muted-foreground [&.active]:text-primary"
          activeProps={{ className: "active" }}
        >
          <item.icon className="h-5 w-5" />
          {item.title}
        </Link>
      ))}
    </div>
  );
}
