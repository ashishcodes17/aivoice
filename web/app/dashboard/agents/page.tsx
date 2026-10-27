import Link from "next/link";
import { Suspense } from "react";
import { BotIcon, PlusIcon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Page, PageFallback, PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOrg } from "@/lib/dashboard";
import { LANGUAGES, TTS_PROVIDERS } from "@/lib/languages";
import type { Agent } from "@/lib/types";

export const metadata = { title: "Agents" };

const NewAgent = () => (
  <Button render={<Link href="/dashboard/agents/new" />}>
    <PlusIcon />
    New agent
  </Button>
);

export default function AgentsPage() {
  return (
    <Page>
      <PageHeader title="Agents" description="Each agent has its own prompt, language and voice." action={<NewAgent />} />
      <Suspense fallback={<PageFallback />}>
        <AgentList />
      </Suspense>
    </Page>
  );
}

async function AgentList() {
  const { supabase, org } = await requireOrg();
  const { data } = await supabase.from("agents").select("*").eq("org_id", org.id).order("created_at", { ascending: false });
  const agents = (data ?? []) as Agent[];

  if (!agents.length) {
    return (
      <EmptyState icon={BotIcon} title="No agents yet" description="Create your first agent, then connect a phone number to it.">
        <NewAgent />
      </EmptyState>
    );
  }

  const label = (list: { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Language</TableHead>
            <TableHead>Voice</TableHead>
            <TableHead>Model</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <Link href={`/dashboard/agents/${a.id}`} className="font-medium hover:underline">
                  {a.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{label(LANGUAGES, a.language)}</TableCell>
              <TableCell>
                <Badge variant="outline">{label(TTS_PROVIDERS, a.tts_provider)}</Badge>
              </TableCell>
              <TableCell className="font-mono text-muted-foreground text-xs">{a.llm_model}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
