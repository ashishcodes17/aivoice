import Link from "next/link";
import { Suspense } from "react";
import { BotIcon, ClockIcon, PhoneCallIcon, WalletIcon } from "lucide-react";
import { AgentTemplates } from "@/components/dashboard/agent-templates";
import { GetStarted } from "@/components/dashboard/get-started";
import { CallsTable } from "@/components/dashboard/calls-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Page, PageFallback, PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { requireOrg } from "@/lib/dashboard";
import { rupees } from "@/lib/format";
import type { Call } from "@/lib/types";

export const metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <Page>
      <Suspense fallback={<PageFallback />}>
        <Overview />
      </Suspense>
    </Page>
  );
}

async function Overview() {
  const { supabase, org } = await requireOrg();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const count = { count: "exact", head: true } as const;

  const [balance, agents, numbers, callCount, callRows, recent] = await Promise.all([
    supabase.from("wallet_balances").select("balance_paise").eq("org_id", org.id).maybeSingle(),
    supabase.from("agents").select("id", count).eq("org_id", org.id),
    supabase.from("phone_numbers").select("id", count).eq("org_id", org.id),
    supabase.from("calls").select("id", count).eq("org_id", org.id).gte("created_at", since),
    supabase.from("calls").select("duration_seconds").eq("org_id", org.id).gte("created_at", since).limit(5000),
    supabase
      .from("calls")
      .select("id, direction, status, from_number, to_number, duration_seconds, cost_paise, created_at, agents(name)")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const minutes = Math.round((callRows.data ?? []).reduce((s, r) => s + r.duration_seconds, 0) / 60);
  const calls = (recent.data ?? []) as unknown as Call[];
  const steps = [
    { done: (agents.count ?? 0) > 0, title: "Build a voice agent", body: "Describe what it should do, pick a language and voice. About 2 min.", href: "/dashboard/agents/new", cta: "Build your voice agent" },
    { done: (numbers.count ?? 0) > 0, title: "Connect a phone number", body: "Point a phone number at your agent.", href: "/dashboard/numbers", cta: "Add number" },
    { done: (callCount.count ?? 0) > 0, title: "Take your first call", body: "Call your number, or have your agent call you. Calls appear below with transcripts.", href: "/dashboard/numbers", cta: "Get a call" },
  ];

  return (
    <>
      <PageHeader title="Overview" description={`Activity for ${org.name} over the last 30 days.`} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Wallet balance" value={rupees(Number(balance.data?.balance_paise ?? 0))} hint="Top up to keep agents answering" href="/dashboard/wallet" icon={WalletIcon} />
        <StatCard label="Calls" value={String(callCount.count ?? 0)} hint="Last 30 days" href="/dashboard/calls" icon={PhoneCallIcon} />
        <StatCard label="Talk time" value={`${minutes} min`} hint="Last 30 days" icon={ClockIcon} />
        <StatCard label="Agents" value={String(agents.count ?? 0)} hint={`${numbers.count ?? 0} connected number${numbers.count === 1 ? "" : "s"}`} href="/dashboard/agents" icon={BotIcon} />
      </section>

      {steps.some((s) => !s.done) && <GetStarted steps={steps} />}

      <AgentTemplates />

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-base tracking-tight">Recent calls</h2>
          {calls.length > 0 && (
            <Link href="/dashboard/calls" className="text-muted-foreground text-sm hover:text-foreground">
              View all
            </Link>
          )}
        </div>
        <div className="mt-4">
          {calls.length ? (
            <CallsTable calls={calls} />
          ) : (
            <EmptyState icon={PhoneCallIcon} title="No calls yet" description="Calls to your connected numbers will show up here, with their transcripts." />
          )}
        </div>
      </section>
    </>
  );
}
