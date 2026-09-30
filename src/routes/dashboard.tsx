import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DollarSign, ShoppingCart, Receipt, Target, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout, Card } from "@/components/DashboardLayout";
import { formatNumber, formatPKR, pctChange } from "@/lib/format";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Osaka Distribution" },
      {
        name: "description",
        content: "Revenue, orders and targets at a glance for Osaka Distribution.",
      },
      { property: "og:title", content: "Dashboard — Osaka Distribution" },
      {
        property: "og:description",
        content: "Revenue, orders and targets at a glance for Osaka Distribution.",
      },
    ],
  }),
  component: DashboardPage,
});

type RangeKey = "today" | "week" | "month" | "all" | "custom";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom" },
];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function resolveRange(key: RangeKey, customFrom: string, customTo: string) {
  const today = new Date();
  const end = new Date(today);
  const start = new Date(today);
  if (key === "today") {
    // same day
  } else if (key === "week") {
    const dow = (today.getDay() + 6) % 7;
    start.setDate(today.getDate() - dow);
  } else if (key === "month") {
    start.setDate(1);
  } else if (key === "custom") {
    return customFrom && customTo ? { from: customFrom, to: customTo } : null;
  } else {
    return null;
  }
  return { from: iso(start), to: iso(end) };
}

type OrderRow = {
  id: string;
  quantity: number;
  total_amount: number;
  status: string;
  order_date: string;
  products: { name: string } | null;
};

function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("month");
  const [customFrom, setCustomFrom] = useState(iso(new Date()));
  const [customTo, setCustomTo] = useState(iso(new Date()));

  const bounds = resolveRange(range, customFrom, customTo);

  const ordersQuery = useQuery({
    queryKey: ["orders-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, quantity, total_amount, status, order_date, products(name)")
        .neq("status", "cancelled")
        .order("order_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const targetQuery = useQuery({
    queryKey: ["target-current"],
    queryFn: async () => {
      const first = new Date();
      first.setDate(1);
      const { data, error } = await supabase
        .from("targets")
        .select("*")
        .eq("month", iso(first))
        .maybeSingle();
      if (error) throw error;
      return data as { target_amount: number; predicted_amount: number | null } | null;
    },
  });

  const orders = ordersQuery.data ?? [];

  const { current, previous, chart, products } = useMemo(() => {
    const inRange = (d: string, from: string, to: string) => d >= from && d <= to;
    const currentOrders = bounds
      ? orders.filter((o) => inRange(o.order_date, bounds.from, bounds.to))
      : orders;

    let previousOrders: OrderRow[] = [];
    if (bounds) {
      const from = new Date(bounds.from);
      const to = new Date(bounds.to);
      const lengthDays = Math.max(1, Math.round((+to - +from) / 86_400_000) + 1);
      const prevTo = new Date(from);
      prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo);
      prevFrom.setDate(prevFrom.getDate() - (lengthDays - 1));
      previousOrders = orders.filter((o) => inRange(o.order_date, iso(prevFrom), iso(prevTo)));
    }

    const sum = (rows: OrderRow[]) => rows.reduce((a, o) => a + Number(o.total_amount), 0);

    const byDate = new Map<string, number>();
    currentOrders.forEach((o) => {
      byDate.set(o.order_date, (byDate.get(o.order_date) ?? 0) + Number(o.total_amount));
    });
    const chartData = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({
        date: new Date(date).toLocaleDateString("en-PK", { day: "2-digit", month: "short" }),
        revenue,
      }));

    const byProduct = new Map<string, { units: number; revenue: number }>();
    currentOrders.forEach((o) => {
      const name = o.products?.name ?? "Unknown product";
      const entry = byProduct.get(name) ?? { units: 0, revenue: 0 };
      entry.units += o.quantity;
      entry.revenue += Number(o.total_amount);
      byProduct.set(name, entry);
    });
    const productRows = [...byProduct.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      current: {
        revenue: sum(currentOrders),
        count: currentOrders.length,
        aov: currentOrders.length ? sum(currentOrders) / currentOrders.length : 0,
      },
      previous: {
        revenue: sum(previousOrders),
        count: previousOrders.length,
        aov: previousOrders.length ? sum(previousOrders) / previousOrders.length : 0,
      },
      chart: chartData,
      products: productRows,
    };
  }, [orders, bounds]);

  const monthRevenue = useMemo(() => {
    const first = new Date();
    first.setDate(1);
    return orders
      .filter((o) => o.order_date >= iso(first))
      .reduce((a, o) => a + Number(o.total_amount), 0);
  }, [orders]);

  const target = targetQuery.data;
  const targetPct = target?.target_amount
    ? Math.min(100, (monthRevenue / Number(target.target_amount)) * 100)
    : 0;

  const maxProductRevenue = products[0]?.revenue ?? 1;

  return (
    <DashboardLayout title="Dashboard" subtitle="Welcome back to Osaka Distribution">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              range === r.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-input bg-card px-2 py-1.5 text-sm text-foreground"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-input bg-card px-2 py-1.5 text-sm text-foreground"
            />
          </div>
        )}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard
          icon={DollarSign}
          label="Total Sales"
          value={formatPKR(current.revenue)}
          change={pctChange(current.revenue, previous.revenue)}
          tone="info"
        />
        <StatCard
          icon={ShoppingCart}
          label="Order Count"
          value={formatNumber(current.count)}
          change={pctChange(current.count, previous.count)}
          tone="success"
        />
        <StatCard
          icon={Receipt}
          label="Average Order Value"
          value={formatPKR(current.aov)}
          change={pctChange(current.aov, previous.aov)}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h3 className="mb-6 text-lg font-semibold text-foreground">Revenue trend</h3>
          <div className="h-72 w-full">
            {chart.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No sales in this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ left: 8, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => formatPKR(v, true)}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      color: "var(--color-foreground)",
                      fontSize: 12,
                    }}
                    formatter={(v) => [formatPKR(Number(v)), "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#rev)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">This month's target</h3>
            </div>
            {target ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Achieved</span>
                  <span className="text-lg font-bold text-foreground">
                    {formatPKR(monthRevenue)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${targetPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Target {formatPKR(Number(target.target_amount))}
                  </span>
                  <span className="font-medium text-foreground">{targetPct.toFixed(1)}%</span>
                </div>
                {target.predicted_amount != null && (
                  <p className="text-xs text-muted-foreground">
                    Predicted month end: {formatPKR(Number(target.predicted_amount))}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No target set for this month yet. An Owner can set it in Settings.
              </p>
            )}
          </Card>

          <Card>
            <h3 className="mb-4 text-lg font-semibold text-foreground">Product breakdown</h3>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">No product sales in this period.</p>
            ) : (
              <div className="space-y-4">
                {products.map((p) => (
                  <div key={p.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-foreground">{p.name}</span>
                      <span className="shrink-0 text-sm font-medium text-foreground">
                        {formatPKR(p.revenue)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${(p.revenue / maxProductRevenue) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{formatNumber(p.units)} units</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  change,
  tone,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  change: number | null;
  tone: "info" | "success" | "warning";
}) {
  const toneBg = {
    info: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
  }[tone];
  const up = (change ?? 0) >= 0;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <div className={`rounded-lg p-2 ${toneBg}`}>
          <Icon className="h-5 w-5" />
        </div>
        {change != null &&
          (up ? (
            <TrendingUp className="h-4 w-4 text-success" />
          ) : (
            <TrendingDown className="h-4 w-4 text-destructive" />
          ))}
      </div>
      <h3 className="mb-1 font-medium text-muted-foreground">{label}</h3>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p
        className={`mt-1 text-sm ${
          change == null ? "text-muted-foreground" : up ? "text-success" : "text-destructive"
        }`}
      >
        {change == null
          ? "No comparison period"
          : `${up ? "+" : ""}${change.toFixed(1)}% vs previous period`}
      </p>
    </Card>
  );
}
