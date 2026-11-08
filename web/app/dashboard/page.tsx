import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon, AudioLinesIcon, BarChart3Icon, BotIcon, ClockIcon, MessageCircleIcon, PhoneCallIcon, PhoneIcon, PlusIcon, WalletIcon } from "lucide-react";
import { AgentTemplates } from "@/components/dashboard/agent-templates";
import { GetStarted } from "@/components/dashboard/get-started";
import { AgentAvatar } from "@/components/dashboard/agent-avatar";
import { CallsChart, type DayCount } from "@/components/dashboard/calls-chart";
import { Page, PageFallback } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { LANGUAGES } from "@/lib/languages";
import { StatCard, type Trend } from "@/components/dashboard/stat-card";
import { requireOrg } from "@/lib/dashboard";
import { rupees } from "@/lib/format";

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

const LOW_BALANCE_PAISE = 10000; // under Rs 100
const DAYS = 14;

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }); // 2026-11-08
const dayWeekday = new Intl.DateTimeFormat("en-IN", { weekday: "narrow", timeZone: "Asia/Kolkata" });
const dayLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date())) % 24;
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

async function Overview() {
  const { supabase, org } = await requireOrg();
  const now = Date.now();
  const since = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const count = { count: "exact", head: true } as const;

  const [balance, agents, agentList, numbers, callCount, callRows] = await Promise.all([
    supabase.from("wallet_balances").select("balance_paise").eq("org_id", org.id).maybeSingle(),
    supabase.from("agents").select("id", count).eq("org_id", org.id),
    supabase.from("agents").select("id, name, language").eq("org_id", org.id).order("created_at", { ascending: false }).limit(4),
    supabase.from("phone_numbers").select("id", count).eq("org_id", org.id),
    supabase.from("calls").select("id", count).eq("org_id", org.id).gte("created_at", since),
    supabase.from("calls").select("duration_seconds, created_at").eq("org_id", org.id).gte("created_at", since).limit(5000),
  ]);

  const rows = callRows.data ?? [];
  const seconds = rows.reduce((s, r) => s + r.duration_seconds, 0);
  const minutes = Math.round(seconds / 60);
  const avg = rows.length ? Math.round(seconds / rows.length) : 0;
  const balancePaise = Number(balance.data?.balance_paise ?? 0);
  const low = balancePaise < LOW_BALANCE_PAISE;
  const agentCount = agents.count ?? 0;
  const numberCount = numbers.count ?? 0;

  const perDay = new Map<string, number>();
  for (const r of rows) {
    const k = dayKey.format(new Date(r.created_at));
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const days: DayCount[] = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(now - (DAYS - 1 - i) * 86400000);
    const day = dayKey.format(d);
    return { day, label: dayLabel.format(d), weekday: dayWeekday.format(d), today: i === DAYS - 1, count: perDay.get(day) ?? 0 };
  });
  const lastDays = days.reduce((s, d) => s + d.count, 0);
  // This week against the week before, from the same 30 days of calls.
  const week = 7 * 86400000;
  const thisWeek = rows.filter((r) => new Date(r.created_at).getTime() > now - week).length;
  const prevWeek = rows.filter((r) => { const t = new Date(r.created_at).getTime(); return t <= now - week && t > now - 2 * week; }).length;
  const callTrend: Trend = { percent: prevWeek ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : null, label: "vs last week" };

  const steps = [
    { done: agentCount > 0, title: "Build a voice agent", body: "Describe what it should do, pick a language and voice. About 2 min.", href: "/dashboard/agents/new", cta: "Build your voice agent" },
    { done: numberCount > 0, title: "Connect a phone number", body: "Point a phone number at your agent.", href: "/dashboard/numbers", cta: "Add number" },
    { done: (callCount.count ?? 0) > 0, title: "Take your first call", body: "Open an agent and press Test agent, or call your number. Calls show up with transcripts.", href: "/dashboard/agents", cta: "Test an agent" },
  ];
  const onboarding = steps.some((s) => !s.done);

  return (
    <>
      <header className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/12 via-primary/5 to-transparent p-5 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-muted-foreground text-sm">{greeting()}</p>
            <h1 className="mt-0.5 truncate font-heading font-semibold text-3xl tracking-[-0.03em] sm:text-4xl">{org.name}</h1>
            <p className="mt-2 max-w-md text-muted-foreground text-sm sm:text-base">
              {(callCount.count ?? 0) > 0
                ? `${thisWeek} ${thisWeek === 1 ? "call" : "calls"} this week and ${minutes} minutes of talk time in the last 30 days.`
                : "Your agents are ready when you are. Build one, connect a number and take your first call."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="bg-background/70 backdrop-blur" render={<Link href="/dashboard/wallet" />}>
              <WalletIcon /> Top up
            </Button>
            <Button render={<Link href="/dashboard/agents/new" />}>
              <PlusIcon /> New agent
            </Button>
          </div>
        </div>
      </header>

      {low && (
        <Link href="/dashboard/wallet" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/15">
          <span>
            <span className="font-medium">{balancePaise < 0 ? "Your wallet is overdrawn." : "Your wallet is running low."}</span>{" "}
            <span className="text-muted-foreground">Agents stop answering when the balance runs out.</span>
          </span>
          <span className="flex items-center gap-1 font-medium">
            Top up <ArrowRightIcon className="size-4" />
          </span>
        </Link>
      )}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Wallet balance" value={rupees(balancePaise)} hint={low ? "Top up soon" : "Ready for calls"} href="/dashboard/wallet" icon={WalletIcon} />
        <StatCard label="Calls" value={String(callCount.count ?? 0)} hint="Last 30 days" trend={callTrend} href="/dashboard/calls" icon={PhoneCallIcon} />
        <StatCard label="Talk time" value={`${minutes} min`} hint={avg ? `About ${Math.floor(avg / 60)}m ${String(avg % 60).padStart(2, "0")}s per call` : "Last 30 days"} icon={ClockIcon} />
        <StatCard label="Agents" value={String(agentCount)} hint={`${numberCount} connected number${numberCount === 1 ? "" : "s"}`} href="/dashboard/agents" icon={BotIcon} />
      </section>

      <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/dashboard/agents", label: "Test an agent", icon: PhoneIcon },
          { href: "/dashboard/voices", label: "Browse voices", icon: AudioLinesIcon },
          { href: "/dashboard/whatsapp", label: "WhatsApp", icon: MessageCircleIcon },
          { href: "/dashboard/usage", label: "Usage & reports", icon: BarChart3Icon },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 text-sm transition-colors hover:border-primary/30 hover:bg-primary/5">
            <Icon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
            <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </nav>

      {onboarding && <GetStarted steps={steps} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border bg-card p-4 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-heading font-semibold text-base tracking-tight">Calls, last {DAYS} days</h2>
              <span className="text-muted-foreground text-sm tabular-nums">{lastDays} total</span>
            </div>
            <div className="mt-5">
              {lastDays > 0 ? <CallsChart days={days} /> : <p className="py-10 text-center text-muted-foreground text-sm">No calls in this period yet.</p>}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold text-base tracking-tight">Your agents</h2>
              <Link href="/dashboard/agents" className="text-muted-foreground text-sm hover:text-foreground">
                All
              </Link>
            </div>
            <ul className="mt-3 divide-y">
              {(agentList.data ?? []).map((a) => (
                <li key={a.id}>
                  <Link href={`/dashboard/agents/${a.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
                    <AgentAvatar seed={a.id} className="size-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-sm">{a.name}</span>
                      <span className="block truncate text-muted-foreground text-xs">{LANGUAGES.find((l) => l.value === a.language)?.label ?? a.language}</span>
                    </span>
                    <ArrowRightIcon className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
              {(agentList.data ?? []).length === 0 && <li className="py-6 text-center text-muted-foreground text-sm">No agents yet.</li>}
            </ul>
            <Button variant="outline" size="sm" className="mt-3 w-full" render={<Link href="/dashboard/agents/new" />}>
              <PlusIcon /> New agent
            </Button>
          </section>
        </aside>
      </div>

      <AgentTemplates />
    </>
  );
}
