import { Suspense } from "react";
import { BarChart3Icon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Page, PageFallback, PageHeader } from "@/components/dashboard/page-header";
import { RangeTabs } from "@/components/dashboard/range-tabs";
import { StatCard } from "@/components/dashboard/stat-card";
import { AgentChart, CallsChart, MessagesChart, SpendChart } from "@/components/dashboard/usage-charts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-black/[0.03] shadow-xs">
      <h2 className="font-heading font-semibold text-base tracking-tight">{title}</h2>
      <p className="mt-0.5 mb-4 text-muted-foreground text-sm">{description}</p>
      {children}
    </section>
  );
}

async function Usage({ searchParams }: { searchParams: PageProps<"/dashboard/usage">["searchParams"] }) {
  const days = parseRange((await searchParams).range);
  const { supabase, org } = await requireOrg();
  const since = rangeStart(days);

  const [callsRes, messagesRes] = await Promise.all([
    supabase
      .from("calls")
      .select("created_at, direction, duration_seconds, cost_paise, agents(name)")
      .eq("org_id", org.id)
      .gte("created_at", since)
      .limit(10000),
    supabase.from("whatsapp_messages").select("created_at, direction").eq("org_id", org.id).gte("created_at", since).limit(10000),
  ]);
  const { callSeries, messageSeries, byAgent, totals } = summarize(
    lastDays(days),
    (callsRes.data ?? []) as unknown as CallRow[],
    (messagesRes.data ?? []) as MessageRow[],
  );

  return (
    <>
      <PageHeader title="Usage & reports" description={`Calls, spend and WhatsApp activity for ${org.name}.`} action={<RangeTabs current={days} />} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Calls" value={String(totals.calls)} hint={`Last ${days} days`} />
        <StatCard label="Talk time" value={`${Math.round(totals.minutes)} min`} hint={`Average call ${duration(Math.round(totals.avgSeconds))}`} />
        <StatCard label="Call spend" value={"₹" + totals.spend.toLocaleString("en-IN", { maximumFractionDigits: 2 })} hint="Charged to your wallet" />
        <StatCard label="WhatsApp messages" value={String(totals.messages)} hint="Customers and agent replies" />
      </section>

      {totals.calls === 0 && totals.messages === 0 ? (
        <EmptyState icon={BarChart3Icon} title="No activity in this period" description="Charts appear here once your agents take calls or answer WhatsApp messages." />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Calls per day" description="Inbound and outbound.">
              <CallsChart data={callSeries} />
            </ChartCard>
            <ChartCard title="Spend per day" description="Wallet charges for calls, in rupees.">
              <SpendChart data={callSeries} />
            </ChartCard>
            <ChartCard title="WhatsApp per day" description="Customer messages and your agent's replies.">
              <MessagesChart data={messageSeries} />
            </ChartCard>
            <ChartCard title="Talk time by agent" description="Minutes on calls, top agents.">
              {byAgent.length ? <AgentChart data={byAgent} /> : <p className="py-10 text-center text-muted-foreground text-sm">No calls yet.</p>}
            </ChartCard>
          </div>

          {byAgent.length > 0 && (
            <section>
              <h2 className="font-heading font-semibold text-base tracking-tight">By agent</h2>
              <div className="mt-4 overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Talk time</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byAgent.map((a) => (
                      <TableRow key={a.name}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{a.calls}</TableCell>
                        <TableCell className="text-right tabular-nums">{Math.round(a.minutes * 10) / 10} min</TableCell>
                        <TableCell className="text-right tabular-nums">₹{a.spend.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
