import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout, Card } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Osaka Distribution" },
      { name: "description", content: "Your account details and password for the dashboard." },
      { property: "og:title", content: "Profile — Osaka Distribution" },
      {
        property: "og:description",
        content: "Your account details and password for the dashboard.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, role, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
  }, [profile?.full_name]);

  const saveName = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("Profile updated");
  };

  const changePassword = async () => {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    toast.success("Password changed");
  };


  return (
    <DashboardLayout title="Profile" subtitle="Your account details">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-foreground">Account</h3>
          <dl className="mb-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium text-foreground">{user?.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium capitalize text-primary">{role ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="font-medium text-foreground">{formatDate(user?.created_at)}</dd>
            </div>
          </dl>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <button
            onClick={() => void saveName()}
            disabled={busy}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Save changes
          </button>
        </Card>

        <Card>
          <h3 className="mb-4 text-lg font-semibold text-foreground">Change password</h3>
          <label className="mb-1.5 block text-sm font-medium text-foreground">New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <button
            onClick={() => void changePassword()}
            disabled={busy}
            className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            Update password
          </button>
        </Card>
      </div>
    </DashboardLayout>
  );
}
