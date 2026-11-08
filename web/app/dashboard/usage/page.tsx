import { Suspense } from "react";
import { BarChart3Icon, ClockIcon, MessageCircleIcon, PhoneCallIcon, WalletIcon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Page, PageFallback, PageHeader } from "@/components/dashboard/page-header";
import { RangeTabs } from "@/components/dashboard/range-tabs";
import { AgentAvatar } from "@/components/dashboard/agent-avatar";
import { StatCard, type Trend } from "@/components/dashboard/stat-card";
import { CallsChart, MessagesChart, SpendChart } from "@/components/dashboard/usage-charts";
import { requireOrg } from "@/lib/dashboard";
import { duration } from "@/lib/format";
import { lastDays, parseRange, rangeStart, summarize, type CallRow, type MessageRow } from "@/lib/usage";

export const metadata = { title: "Usage & reports" };

export default function UsagePage({ searchParams }: PageProps<"/dashboard/usage">) {
  return (
    <Page>
      <Suspense fallback={<PageFallback />}>
        <Usage searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}

function ChartCard({ title, description, total, children }: { title: string; description: string; total?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-black/[0.03] shadow-xs sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading font-semibold text-base tracking-tight">{title}</h2>
          <p className="mt-0.5 text-muted-foreground text-sm">{description}</p>
        </div>
        {total && <span className="shrink-0 rounded-full bg-muted px-3 py-1 font-medium text-sm tabular-nums">{total}</span>}
      </div>
      {children}
    </section>
  );
}

const rupee = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const change = (now: number, before: number, label: string, neutral = false): Trend => ({ percent: before ? Math.round(((now - before) / before) * 100) : null, label, neutral });

async function Usage({ searchParams }: { searchParams: PageProps<"/dashboard/usage">["searchParams"] }) {
  const days = parseRange((await searchParams).range);
  const { supabase, org } = await requireOrg();
  const since = rangeStart(days);
  const earlier = rangeStart(days * 2); // the period before, to show how this one compares

  const [callsRes, messagesRes] = await Promise.all([
    supabase
      .from("calls")
      .select("created_at, direction, duration_seconds, cost_paise, agents(name)")
      .eq("org_id", org.id)
      .gte("created_at", earlier)
      .limit(10000),
    supabase.from("whatsapp_messages").select("created_at, direction").eq("org_id", org.id).gte("created_at", earlier).limit(10000),
  ]);
  const allCalls = (callsRes.data ?? []) as unknown as CallRow[];
  const allMessages = (messagesRes.data ?? []) as MessageRow[];
  const current = (r: { created_at: string }) => r.created_at >= since;
  const { callSeries, messageSeries, byAgent, totals } = summarize(lastDays(days), allCalls.filter(current), allMessages.filter(current));

  const before = {
    calls: allCalls.filter((c) => !current(c)).length,
    minutes: allCalls.filter((c) => !current(c)).reduce((s, c) => s + c.duration_seconds / 60, 0),
    spend: allCalls.filter((c) => !current(c)).reduce((s, c) => s + c.cost_paise / 100, 0),
    messages: allMessages.filter((m) => !current(m)).length,
  };
  const vs = `vs previous ${days} days`;
  const topMinutes = Math.max(1, ...byAgent.map((a) => a.minutes));

  return (
    <>
      <PageHeader title="Usage & reports" description={`Calls, spend and WhatsApp activity for ${org.name}.`} action={<RangeTabs current={days} />} />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Calls" value={String(totals.calls)} hint={`Last ${days} days`} icon={PhoneCallIcon} trend={change(totals.calls, before.calls, vs)} />
        <StatCard label="Talk time" value={`${Math.round(totals.minutes)} min`} hint={`Average call ${duration(Math.round(totals.avgSeconds))}`} icon={ClockIcon} trend={change(totals.minutes, before.minutes, vs)} />
        <StatCard label="Call spend" value={rupee(totals.spend)} hint="Charged to your wallet" icon={WalletIcon} trend={change(totals.spend, before.spend, vs, true)} />
        <StatCard label="WhatsApp messages" value={String(totals.messages)} hint="Customers and agent replies" icon={MessageCircleIcon} trend={change(totals.messages, before.messages, vs)} />
      </section>

      {totals.calls === 0 && totals.messages === 0 ? (
        <EmptyState icon={BarChart3Icon} title="No activity in this period" description="Charts appear here once your agents take calls or answer WhatsApp messages." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Calls per day" description="Inbound and outbound." total={`${totals.calls} calls`}>
            <CallsChart data={callSeries} />
          </ChartCard>
          <ChartCard title="Spend per day" description="Wallet charges for calls, in rupees." total={rupee(totals.spend)}>
            <SpendChart data={callSeries} />
          </ChartCard>
          <ChartCard title="WhatsApp per day" description="Customer messages and your agent's replies." total={`${totals.messages} messages`}>
            <MessagesChart data={messageSeries} />
          </ChartCard>
          <ChartCard title="By agent" description="Who handled the most talk time.">
            {byAgent.length ? (
              <ul className="space-y-4">
                {byAgent.slice(0, 6).map((a) => (
                  <li key={a.name} className="flex items-center gap-3">
                    <AgentAvatar seed={a.name} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate font-medium text-sm">{a.name}</p>
                        <p className="shrink-0 text-muted-foreground text-xs tabular-nums">{Math.round(a.minutes * 10) / 10} min</p>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.max(3, (a.minutes / topMinutes) * 100)}%` }} />
                      </div>
                      <p className="mt-1 text-muted-foreground text-xs tabular-nums">
                        {a.calls} {a.calls === 1 ? "call" : "calls"} · {rupee(a.spend)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-10 text-center text-muted-foreground text-sm">No calls yet.</p>
            )}
          </ChartCard>
        </div>
      )}
    </>
  );
}
