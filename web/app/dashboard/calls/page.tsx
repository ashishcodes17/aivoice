import { Suspense } from "react";
import { PhoneCallIcon } from "lucide-react";
import { CallsList } from "@/components/dashboard/calls-list";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Page, PageFallback, PageHeader } from "@/components/dashboard/page-header";
import { requireOrg } from "@/lib/dashboard";
import type { Call } from "@/lib/types";

export const metadata = { title: "Calls" };

export default function CallsPage() {
  return (
    <Page>
      <PageHeader title="Calls" description="Every call your agents have handled." />
      <Suspense fallback={<PageFallback />}>
        <CallList />
      </Suspense>
    </Page>
  );
}

async function CallList() {
  const { supabase, org } = await requireOrg();
  const { data } = await supabase
    .from("calls")
    .select("id, direction, status, from_number, to_number, duration_seconds, cost_paise, created_at, metadata, agents(name)")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const calls = (data ?? []) as unknown as Call[];
  return calls.length ? (
    <CallsList calls={calls} />
  ) : (
    <EmptyState icon={PhoneCallIcon} title="No calls yet" description="Calls to your connected numbers will show up here, with their transcripts." />
  );
}
