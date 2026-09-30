import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout, Card } from "@/components/DashboardLayout";
import { formatDate, formatPKR } from "@/lib/format";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [
      { title: "Payments — Osaka Distribution" },
      { name: "description", content: "Track what each distributor owes and when it is due." },
      { property: "og:title", content: "Payments — Osaka Distribution" },
      {
        property: "og:description",
        content: "Track what each distributor owes and when it is due.",
      },
    ],
  }),
  component: PaymentsPage,
});

type Payment = {
  id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  distributor_id: string;
  distributors: { name: string; payment_terms_days: number } | null;
};

function daysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((+due - +today) / 86_400_000);
}

function PaymentsPage() {
  const qc = useQueryClient();

  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, due_date, paid_date, status, distributor_id, distributors(name, payment_terms_days)")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Payment[];
    },
  });

  const markPaid = useMutation({
    mutationFn: async (p: Payment) => {
      const { error } = await supabase
        .from("payments")
        .update({ status: "paid", paid_date: new Date().toISOString().slice(0, 10) })
        .eq("id", p.id);
      if (error) throw error;
      await logActivity(
        "Payment recorded",
        `${p.distributors?.name ?? "Distributor"} — ${formatPKR(Number(p.amount))}`,
      );
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      void qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not record payment"),
  });

  const payments = paymentsQuery.data ?? [];

  const rows = useMemo(() => {
    const map = new Map<
      string,
      { name: string; terms: number; owed: number; nextDue: string | null; overdue: boolean }
    >();
    payments
      .filter((p) => p.status !== "paid")
      .forEach((p) => {
        const key = p.distributor_id;
        const entry = map.get(key) ?? {
          name: p.distributors?.name ?? "Unknown",
          terms: p.distributors?.payment_terms_days ?? 30,
          owed: 0,
          nextDue: null as string | null,
          overdue: false,
        };
        entry.owed += Number(p.amount);
        if (!entry.nextDue || p.due_date < entry.nextDue) entry.nextDue = p.due_date;
        if (daysUntil(p.due_date) < 0) entry.overdue = true;
        map.set(key, entry);
      });
    return [...map.values()].sort((a, b) => b.owed - a.owed);
  }, [payments]);

  const totalOwed = rows.reduce((a, r) => a + r.owed, 0);
  const overdueCount = rows.filter((r) => r.overdue).length;

  return (
    <DashboardLayout
      title="Payments"
      subtitle={`${formatPKR(totalOwed)} outstanding · ${overdueCount} distributor(s) overdue`}
    >
      <Card className="mb-6 p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Distributor</th>
                <th className="px-4 py-3 text-right font-medium">Amount owed</th>
                <th className="px-4 py-3 font-medium">Next payment due</th>
                <th className="px-4 py-3 font-medium">Days until due</th>
                <th className="px-4 py-3 font-medium">Terms</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const days = r.nextDue ? daysUntil(r.nextDue) : null;
                return (
                  <tr key={r.name} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {r.name}
                        {r.overdue && (
                          <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                            Overdue
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatPKR(r.owed)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(r.nextDue)}</td>
                    <td
                      className={`px-4 py-3 font-medium ${
                        days != null && days < 0
                          ? "text-destructive"
                          : days != null && days <= 7
                            ? "text-warning"
                            : "text-muted-foreground"
                      }`}
                    >
                      {days == null
                        ? "—"
                        : days < 0
                          ? `${Math.abs(days)} days late`
                          : `${days} days`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.terms} days</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Nothing outstanding. Every distributor is settled up.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-0">
        <h3 className="px-4 py-4 text-lg font-semibold text-foreground">All payments</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Distributor</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Paid</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {p.distributors?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">
                    {formatPKR(Number(p.amount))}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(p.due_date)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(p.paid_date)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                        p.status === "paid"
                          ? "bg-success/10 text-success"
                          : daysUntil(p.due_date) < 0
                            ? "bg-destructive/10 text-destructive"
                            : "bg-warning/10 text-warning"
                      }`}
                    >
                      {p.status === "paid" ? "paid" : daysUntil(p.due_date) < 0 ? "overdue" : "pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.status !== "paid" && (
                      <button
                        onClick={() => markPaid.mutate(p)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted"
                      >
                        Mark paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardLayout>
  );
}
