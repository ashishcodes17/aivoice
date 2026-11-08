import { AgentForm } from "@/components/dashboard/agent-form";
import { templateById } from "@/lib/agent-templates";

export const metadata = { title: "New agent" };

export default async function NewAgentPage({ searchParams }: PageProps<"/dashboard/agents/new">) {
  const raw = (await searchParams).template;
  const template = templateById(typeof raw === "string" ? raw : undefined);
  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8">
      <AgentForm template={template} />
    </div>
  );
}
