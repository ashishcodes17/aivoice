import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRightIcon, AudioLinesIcon, BotIcon, LanguagesIcon, PhoneIcon, PlusIcon } from "lucide-react";
import { AgentAvatar } from "@/components/dashboard/agent-avatar";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Page, PageFallback, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { requireOrg } from "@/lib/dashboard";
import { LANGUAGES } from "@/lib/languages";
import { findVoice } from "@/lib/voices";
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

/** The greeting as callers hear it: {{name}} replaced by the agent's own value where it has one. */
function spoken(agent: Agent) {
  const vars = agent.config?.variables ?? {};
  return (agent.first_message || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (m, n: string) => vars[n]?.trim() || m);
}

async function AgentList() {
  const { supabase, org } = await requireOrg();
  const [{ data }, { data: nums }] = await Promise.all([
    supabase.from("agents").select("*").eq("org_id", org.id).order("created_at", { ascending: false }),
    supabase.from("phone_numbers").select("agent_id").eq("org_id", org.id),
  ]);
  const agents = (data ?? []) as Agent[];

  if (!agents.length) {
    return (
      <EmptyState icon={BotIcon} title="No agents yet" description="Create your first agent, then connect a phone number to it.">
        <NewAgent />
      </EmptyState>
    );
  }

  const numberCount = new Map<string, number>();
  for (const n of nums ?? []) if (n.agent_id) numberCount.set(n.agent_id, (numberCount.get(n.agent_id) ?? 0) + 1);

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {agents.map((a) => {
        const language = LANGUAGES.find((l) => l.value === a.language)?.label ?? a.language;
        const voice = findVoice(a.tts_provider, a.tts_voice ?? "", a.language)?.label ?? a.tts_voice ?? "Default voice";
        const linked = numberCount.get(a.id) ?? 0;
        return (
          <li key={a.id}>
            <Link
              href={`/dashboard/agents/${a.id}`}
              className="group flex h-full flex-col rounded-2xl border bg-card p-5 shadow-black/[0.03] shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <AgentAvatar seed={a.id} className="size-12" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-heading font-semibold text-base tracking-tight">{a.name}</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground text-xs">
                    <span className={linked ? "size-1.5 rounded-full bg-success" : "size-1.5 rounded-full bg-muted-foreground/40"} />
                    {linked ? `Live on ${linked} number${linked === 1 ? "" : "s"}` : "Not connected yet"}
                  </p>
                </div>
                <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>

              <p className="mt-4 line-clamp-3 flex-1 rounded-xl rounded-tl-sm bg-muted/60 px-3.5 py-2.5 text-[13px] text-foreground/80 leading-5">
                {spoken(a) || <span className="text-muted-foreground">No greeting set.</span>}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
                  <LanguagesIcon className="size-3.5 text-muted-foreground" /> {language}
                </span>
                <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-1">
                  <AudioLinesIcon className="size-3.5 shrink-0 text-muted-foreground" /> <span className="truncate">{voice}</span>
                </span>
                {linked > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
                    <PhoneIcon className="size-3.5 text-muted-foreground" /> {linked}
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
      <li>
        <Link
          href="/dashboard/agents/new"
          className="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-5 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <PlusIcon className="size-5" />
          </span>
          <span className="font-medium text-sm">New agent</span>
          <span className="text-center text-xs">Pick a language and a voice</span>
        </Link>
      </li>
    </ul>
  );
}
