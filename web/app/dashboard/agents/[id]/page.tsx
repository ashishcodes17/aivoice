import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AgentForm } from "@/components/dashboard/agent-form";
import { PageFallback } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { deleteAgent } from "@/app/dashboard/actions";
import { requireOrg } from "@/lib/dashboard";
import type { Agent } from "@/lib/types";

export const metadata = { title: "Edit agent" };

export default function EditAgentPage({ params }: PageProps<"/dashboard/agents/[id]">) {
  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-5 sm:px-6">
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

  return (
    <>
      <AgentForm agent={agent} />
      <section id="danger" className="mt-12 max-w-2xl scroll-mt-6 border-t pt-8">
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
