import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AgentForm } from "@/components/dashboard/agent-form";
import { PageFallback } from "@/components/dashboard/page-header";
import { DeleteAgent } from "@/components/dashboard/delete-agent";
import { deleteAgent } from "@/app/dashboard/actions";
import { requireOrg } from "@/lib/dashboard";
import { formatDid } from "@/lib/phone";
import type { Agent } from "@/lib/types";

export const metadata = { title: "Edit agent" };

export default function EditAgentPage({ params }: PageProps<"/dashboard/agents/[id]">) {
  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<PageFallback />}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}

async function Editor({ params }: { params: PageProps<"/dashboard/agents/[id]">["params"] }) {
  const { id } = await params;
  const { supabase, org } = await requireOrg();
  const { data } = await supabase.from("agents").select("*").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!data) notFound();
  const agent = data as Agent;
  const { data: nums } = await supabase.from("phone_numbers").select("id, did_number, agents(name)").eq("org_id", org.id).not("agent_id", "is", null);
  const testNumbers = (nums ?? []).map((n) => ({ value: n.id as string, label: formatDid(n.did_number as string) }));

  return (
    <AgentForm agent={agent} testNumbers={testNumbers} dangerZone={<DeleteAgent name={agent.name} action={deleteAgent.bind(null, agent.id)} />} />
  );
}
