import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRightIcon, BotIcon, PhoneIcon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { NumberForm } from "@/components/dashboard/number-form";
import { Page, PageFallback, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/dashboard/agent-avatar";
import { DisconnectNumber } from "@/components/dashboard/disconnect-number";
import { removeNumber } from "@/app/dashboard/actions";
import { requireOrg } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format";
import { formatDid } from "@/lib/phone";
import type { PhoneNumber } from "@/lib/types";

export const metadata = { title: "Numbers" };

export default function NumbersPage() {
  return (
    <Page>
      <PageHeader title="Numbers" description="Calls to a connected number are answered by its agent." />
      <Suspense fallback={<PageFallback />}>
        <Numbers />
      </Suspense>
    </Page>
  );
}

async function Numbers() {
  const { supabase, org } = await requireOrg();
  const [agentsRes, numbersRes] = await Promise.all([
    supabase.from("agents").select("id, name").eq("org_id", org.id).order("name"),
    supabase
      .from("phone_numbers")
      .select("id, did_number, agent_id, created_at, agents(name)")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false }),
  ]);
  const agents = (agentsRes.data ?? []).map((a) => ({ value: a.id as string, label: a.name as string }));
  const numbers = (numbersRes.data ?? []) as unknown as PhoneNumber[];

  if (!agents.length) {
    return (
      <EmptyState icon={BotIcon} title="Create an agent first" description="A number needs an agent to answer its calls.">
        <Button render={<Link href="/dashboard/agents/new" />}>New agent</Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-heading font-semibold text-base tracking-tight">
          Your numbers <span className="font-normal text-muted-foreground text-sm">· {numbers.length}</span>
        </h2>
        {numbers.length ? (
          <ul className="space-y-3">
            {numbers.map((n) => (
              <li key={n.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-black/[0.03] shadow-xs sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <PhoneIcon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="whitespace-nowrap font-heading font-semibold text-lg tabular-nums tracking-tight">{formatDid(n.did_number)}</p>
                    <p className="truncate text-muted-foreground text-xs">Connected {formatDateTime(n.created_at)}</p>
                  </div>
                </div>
                <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-end">
                  {n.agent_id ? (
                    <Link href={`/dashboard/agents/${n.agent_id}`} className="group flex min-w-0 items-center gap-2.5 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors hover:border-primary/30 hover:bg-primary/5">
                      <AgentAvatar seed={n.agent_id} className="size-7" />
                      <span className="truncate">{n.agents?.name ?? "Agent"}</span>
                      <ArrowUpRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  ) : (
                    <span className="rounded-full bg-warning/15 px-3 py-1 text-warning-foreground text-sm">No agent</span>
                  )}
                  <DisconnectNumber label={formatDid(n.did_number)} action={removeNumber.bind(null, n.id)} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={PhoneIcon} title="No numbers connected" description="Connect a number below, then point it at your telephony provider's voice endpoint." />
        )}
      </section>

      <div className="max-w-xl">
        <NumberForm agents={agents} />
      </div>
    </div>
  );
}
