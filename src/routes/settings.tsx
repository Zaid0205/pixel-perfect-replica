import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout, Card } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { formatPKR } from "@/lib/format";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Osaka Distribution" },
      { name: "description", content: "Monthly targets, team roles, products and distributors." },
      { property: "og:title", content: "Settings — Osaka Distribution" },
      {
        property: "og:description",
        content: "Monthly targets, team roles, products and distributors.",
      },
    ],
  }),
  component: SettingsPage,
});

function monthStart(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return x.toISOString().slice(0, 10);
}

function SettingsPage() {
  const { isOwner, user } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthStart().slice(0, 7));
  const [targetAmount, setTargetAmount] = useState("");
  const [predicted, setPredicted] = useState("");

  const targetsQuery = useQuery({
    queryKey: ["targets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("targets")
        .select("*")
        .order("month", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const membersQuery = useQuery({
    queryKey: ["members"],
    enabled: isOwner,
    queryFn: async () => {
      const [{ data: profiles, error: pe }, { data: roles, error: re }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pe) throw pe;
      if (re) throw re;
      return (profiles ?? []).map((p) => ({
        ...p,
        role: (roles ?? []).find((r) => r.user_id === p.id)?.role ?? "staff",
      }));
    },
  });

  const saveTarget = useMutation({
    mutationFn: async () => {
      const amount = Number(targetAmount);
      if (!amount) throw new Error("Enter a target amount");
      const monthDate = `${month}-01`;
      const { error } = await supabase.from("targets").upsert(
        {
          month: monthDate,
          target_amount: amount,
          predicted_amount: predicted ? Number(predicted) : null,
        },
        { onConflict: "month" },
      );
      if (error) throw error;
      await logActivity("Monthly target set", `${month} — ${formatPKR(amount)}`);
    },
    onSuccess: () => {
      toast.success("Target saved");
      setTargetAmount("");
      setPredicted("");
      void qc.invalidateQueries({ queryKey: ["targets"] });
      void qc.invalidateQueries({ queryKey: ["target-current"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save target"),
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "owner" | "staff" }) => {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
      await logActivity("Role changed", `${userId} is now ${role}`);
    },
    onSuccess: () => {
      toast.success("Role updated");
      void qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not change role"),
  });

  return (
    <DashboardLayout title="Settings" subtitle="Targets and team access">
      {!isOwner && (
        <Card className="mb-6 flex items-center gap-3">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            You are signed in as Staff. Targets and team access can only be changed by an Owner.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-foreground">Monthly target</h3>
          {isOwner && (
            <div className="mb-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Month</label>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Target (PKR)
                  </label>
                  <input
                    type="number"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Predicted (PKR)
                  </label>
                  <input
                    type="number"
                    value={predicted}
                    onChange={(e) => setPredicted(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
              </div>
              <button
                onClick={() => saveTarget.mutate()}
                disabled={saveTarget.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                Save target
              </button>
            </div>
          )}

          <div className="space-y-2">
            {(targetsQuery.data ?? []).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">
                  {new Date(t.month).toLocaleDateString("en-PK", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="font-medium text-foreground">
                  {formatPKR(Number(t.target_amount))}
                </span>
              </div>
            ))}
            {(targetsQuery.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No targets set yet.</p>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-lg font-semibold text-foreground">Team</h3>
          {!isOwner ? (
            <p className="text-sm text-muted-foreground">Only Owners can manage team access.</p>
          ) : (
            <div className="space-y-2">
              {(membersQuery.data ?? []).map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {m.full_name ?? m.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <select
                    value={m.role}
                    disabled={m.id === user?.id}
                    onChange={(e) =>
                      changeRole.mutate({
                        userId: m.id,
                        role: e.target.value as "owner" | "staff",
                      })
                    }
                    className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-60"
                  >
                    <option value="owner">Owner</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
