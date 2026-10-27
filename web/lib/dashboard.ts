import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Once per request: the signed-in user and their (first) organization.
// RLS limits the organizations query to orgs the user belongs to.
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return { supabase, user: data.user, org };
});

export async function requireOrg() {
  const session = await getSession();
  if (!session.org) redirect("/dashboard");
  return { ...session, org: session.org };
}
