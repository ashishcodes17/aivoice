import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AgentForm } from "@/components/dashboard/agent-form";
import { Page, PageFallback, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { deleteAgent } from "@/app/dashboard/actions";
import { requireOrg } from "@/lib/dashboard";
import type { Agent } from "@/lib/types";

export const metadata = { title: "Edit agent" };

export default function EditAgentPage({ params }: PageProps<"/dashboard/agents/[id]">) {
  return (
    <Page>
      <Suspense fallback={<PageFallback />}>
        <Editor params={params} />
      </Suspense>
    </Page>
  );
}

async function Editor({ params }: { params: PageProps<"/dashboard/agents/[id]">["params"] }) {
  const { id } = await params;
  const { supabase, org } = await requireOrg();
  const { data } = await supabase.from("agents").select("*").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!data) notFound();
  const agent = data as Agent;

  return (
    <>
      <PageHeader title={agent.name} description="Changes apply to the next call." />
      <AgentForm agent={agent} />
      <section className="max-w-2xl border-t pt-8">
        <h2 className="font-medium text-sm">Delete agent</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Numbers connected to this agent will stop being answered until you connect them to another agent.
        </p>
        <form action={deleteAgent.bind(null, agent.id)} className="mt-4">
          <Button type="submit" variant="destructive-outline">
            Delete agent
          </Button>
        </form>
      </section>
    </>
  );
}
