import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout, Card } from "@/components/DashboardLayout";
import { formatDate, formatNumber, formatPKR } from "@/lib/format";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "Sales — Osaka Distribution" },
      { name: "description", content: "Record and review distributor orders in PKR." },
      { property: "og:title", content: "Sales — Osaka Distribution" },
      { property: "og:description", content: "Record and review distributor orders in PKR." },
    ],
  }),
  component: SalesPage,
});

type Order = {
  id: string;
  quantity: number;
  total_amount: number;
  status: string;
  order_date: string;
  distributors: { name: string } | null;
  products: { name: string } | null;
};

function SalesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [distributorId, setDistributorId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [status, setStatus] = useState("pending");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));

  const ordersQuery = useQuery({
    queryKey: ["orders-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, quantity, total_amount, status, order_date, distributors(name), products(name)")
        .order("order_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Order[];
    },
  });

  const distributorsQuery = useQuery({
    queryKey: ["distributors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("distributors").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, unit_price")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const createOrder = useMutation({
    mutationFn: async () => {
      const product = productsQuery.data?.find((p) => p.id === productId);
      if (!product || !distributorId) throw new Error("Pick a distributor and a product");
      const qty = Math.max(1, Number(quantity) || 1);
      const total = qty * Number(product.unit_price);
      const { error } = await supabase.from("orders").insert({
        distributor_id: distributorId,
        product_id: productId,
        quantity: qty,
        total_amount: total,
        status,
        order_date: orderDate,
      });
      if (error) throw error;
      await logActivity(
        "Order entered",
        `${qty} × ${product.name} — ${formatPKR(total)}`,
      );
    },
    onSuccess: () => {
      toast.success("Order recorded");
      setShowForm(false);
      setQuantity("1");
      void qc.invalidateQueries({ queryKey: ["orders-list"] });
      void qc.invalidateQueries({ queryKey: ["orders-all"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save order"),
  });

  const orders = ordersQuery.data ?? [];
  const totalValue = orders.reduce(
    (a, o) => a + (o.status === "cancelled" ? 0 : Number(o.total_amount)),
    0,
  );

  return (
    <DashboardLayout
      title="Sales"
      subtitle={`${formatNumber(orders.length)} orders · ${formatPKR(totalValue)} total`}
      actions={
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "New order"}
        </button>
      }
    >
      {showForm && (
        <Card className="mb-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Record an order</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <Field label="Distributor">
              <select
                value={distributorId}
                onChange={(e) => setDistributorId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">Select…</option>
                {distributorsQuery.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Product">
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">Select…</option>
                {productsQuery.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatPKR(Number(p.unit_price))})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quantity">
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="pending">Pending</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="Order date">
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </Field>
          </div>
          <button
            onClick={() => createOrder.mutate()}
            disabled={createOrder.isPending}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Save order
          </button>
        </Card>
      )}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <Th>Date</Th>
                <Th>Distributor</Th>
                <Th>Product</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <Td>{formatDate(o.order_date)}</Td>
                  <Td className="font-medium text-foreground">{o.distributors?.name ?? "—"}</Td>
                  <Td>{o.products?.name ?? "—"}</Td>
                  <Td className="text-right">{formatNumber(o.quantity)}</Td>
                  <Td className="text-right font-medium text-foreground">
                    {formatPKR(Number(o.total_amount))}
                  </Td>
                  <Td>
                    <StatusBadge status={o.status} />
                  </Td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

export function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-muted-foreground ${className}`}>{children}</td>;
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "delivered"
      ? "bg-success/10 text-success"
      : status === "cancelled"
        ? "bg-destructive/10 text-destructive"
        : "bg-warning/10 text-warning";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${tone}`}>
      {status}
    </span>
  );
}
