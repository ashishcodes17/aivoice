import { AgentForm } from "@/components/dashboard/agent-form";
import { Page, PageHeader } from "@/components/dashboard/page-header";

export const metadata = { title: "New agent" };

export default function NewAgentPage() {
  return (
    <Page>
      <PageHeader title="New agent" description="Set up how your agent sounds and behaves." />
      <AgentForm />
    </Page>
  );
}
