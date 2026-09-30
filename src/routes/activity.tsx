import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout, Card } from "@/components/DashboardLayout";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log — Osaka Distribution" },
      { name: "description", content: "Who did what, and when, across the Osaka dashboard." },
      { property: "og:title", content: "Activity Log — Osaka Distribution" },
      {
        property: "og:description",
        content: "Who did what, and when, across the Osaka dashboard.",
      },
    ],
  }),
  component: ActivityPage,
});

type Entry = {
  id: string;
  user_email: string | null;
  action: string;
  details: string | null;
  created_at: string;
};

function ActivityPage() {
  const { data } = useQuery({
    queryKey: ["activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, user_email, action, details, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  const entries = data ?? [];

  return (
    <DashboardLayout title="Activity Log" subtitle="Newest actions first">
      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDateTime(e.created_at)}
                  </td>
                  <td className="px-4 py-3 text-foreground">{e.user_email ?? "system"}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{e.action}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.details ?? "—"}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No activity recorded yet.
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
