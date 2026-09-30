import { supabase } from "@/integrations/supabase/client";

export async function logActivity(action: string, details?: string) {
  const { data } = await supabase.auth.getUser();
  await supabase.from("activity_log").insert({
    user_id: data.user?.id ?? null,
    user_email: data.user?.email ?? null,
    action,
    details: details ?? null,
  });
}
