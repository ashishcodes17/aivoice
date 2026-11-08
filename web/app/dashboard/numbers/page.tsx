import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRightIcon, BotIcon, FlaskConicalIcon, PhoneIcon, SearchIcon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { NumberForm } from "@/components/dashboard/number-form";
import { Page, PageFallback, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { AgentAvatar } from "@/components/dashboard/agent-avatar";
import { DisconnectNumber } from "@/components/dashboard/disconnect-number";
import { CancelRental } from "@/components/dashboard/cancel-rental";
import { RentNumber } from "@/components/dashboard/rent-number";
import { cancelRental, keepRental, removeNumber } from "@/app/dashboard/actions";
import { NUMBER_PRICE_LABEL, purchasesEnabled } from "@/lib/numbers";
import { TEST_CREDIT_PAISE, TEST_DID_DISPLAY } from "@/lib/test-number";
import { listAvailableNumbers } from "@/lib/voicelink";
import { rupees } from "@/lib/format";
import { requireOrg } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format";
import { formatDid } from "@/lib/phone";
import type { PhoneNumber } from "@/lib/types";

export const metadata = { title: "Numbers" };

export default function NumbersPage({ searchParams }: PageProps<"/dashboard/numbers">) {
  return (
    <Page>
      <PageHeader title="Numbers" description="Calls to a connected number are answered by its agent." />
      <Suspense fallback={<PageFallback />}>
        <Numbers searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}

const dateOnly = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

async function Numbers({ searchParams }: { searchParams: PageProps<"/dashboard/numbers">["searchParams"] }) {
  const q = String((await searchParams).q ?? "").replace(/\D/g, "").slice(0, 10);
  const { supabase, org } = await requireOrg();
  const [agentsRes, numbersRes] = await Promise.all([
    supabase.from("agents").select("id, name").eq("org_id", org.id).order("name"),
    supabase
      .from("phone_numbers")
      .select("id, did_number, agent_id, created_at, source, monthly_fee_paise, renews_at, grace_until, cancel_at_period_end, agents(name)")
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
      <section className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FlaskConicalIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium text-sm">
            Test number <span className="rounded-full bg-primary/10 px-2 py-0.5 font-normal text-primary text-[11px]">Free to try</span>
          </p>
          <p className="mt-0.5 font-heading font-semibold text-lg tabular-nums tracking-tight">{TEST_DID_DISPLAY}</p>
          <p className="mt-1 max-w-xl text-muted-foreground text-sm">
            Shared by every account. Open an agent and press Test agent, and it rings your phone from this number. Every account starts with {rupees(TEST_CREDIT_PAISE)} of free credit.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/dashboard/agents" />}>
          Test an agent
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading font-semibold text-base tracking-tight">
          Your numbers <span className="font-normal text-muted-foreground text-sm">· {numbers.length}</span>
        </h2>
        {numbers.length ? (
          <ul className="space-y-3">
            {numbers.map((n) => {
              const rented = n.source === "purchased";
              const endsOn = n.renews_at ? dateOnly.format(new Date(n.renews_at)) : "";
              return (
                <li key={n.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-black/[0.03] shadow-xs sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3.5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <PhoneIcon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="whitespace-nowrap font-heading font-semibold text-lg tabular-nums tracking-tight">{formatDid(n.did_number)}</p>
                      <p className="truncate text-muted-foreground text-xs">
                        {rented
                          ? n.cancel_at_period_end
                            ? `Rented · ends ${endsOn}`
                            : n.grace_until
                              ? `Rented · payment due, add funds by ${dateOnly.format(new Date(n.grace_until))}`
                              : `Rented · ${rupees(n.monthly_fee_paise)}/month · renews ${endsOn}`
                          : `Connected ${formatDateTime(n.created_at)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 sm:justify-end">
                    {n.agent_id ? (
                      <Link href={`/dashboard/agents/${n.agent_id}`} className="group flex min-w-0 items-center gap-2.5 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors hover:border-primary/30 hover:bg-primary/5">
                        <AgentAvatar seed={n.agent_id} className="size-7" />
                        <span className="truncate">{n.agents?.name ?? "Agent"}</span>
                        <ArrowUpRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                    ) : (
                      <span className="rounded-full bg-warning/15 px-3 py-1 text-warning-foreground text-sm">No agent</span>
                    )}
                    {rented ? (
                      n.cancel_at_period_end ? (
                        <form action={keepRental.bind(null, n.id)}>
                          <Button type="submit" variant="outline" size="sm">
                            Keep it
                          </Button>
                        </form>
                      ) : (
                        <CancelRental label={formatDid(n.did_number)} endsOn={endsOn} action={cancelRental.bind(null, n.id)} />
                      )
                    ) : (
                      <DisconnectNumber label={formatDid(n.did_number)} action={removeNumber.bind(null, n.id)} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={PhoneIcon} title="No numbers of your own yet" description="Rent one below, or connect a number you already own. You can test any agent right now with the test number above." />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading font-semibold text-base tracking-tight">Get a number</h2>
            <p className="mt-0.5 text-muted-foreground text-sm">
              Mobile numbers, {NUMBER_PRICE_LABEL} a month from your wallet. Your agent answers it straight away.
            </p>
          </div>
          <form className="relative w-full sm:w-64">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" defaultValue={q} inputMode="numeric" placeholder="Search digits, e.g. 4040" aria-label="Search numbers" className="h-9 w-full rounded-full border bg-background pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:ring-4 focus:ring-primary/15" />
          </form>
        </div>
        {!purchasesEnabled() && (
          <p className="rounded-xl border border-dashed px-4 py-3 text-muted-foreground text-sm">Renting numbers opens soon. You can already see what is available.</p>
        )}
        <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-muted/60" aria-busy />}>
          <Available q={q} agents={agents} />
        </Suspense>
      </section>

      <section className="max-w-xl space-y-3">
        <h2 className="font-heading font-semibold text-base tracking-tight">Already have a number?</h2>
        <NumberForm agents={agents} />
      </section>
    </div>
  );
}

async function Available({ q, agents }: { q: string; agents: { value: string; label: string }[] }) {
  const r = await listAvailableNumbers(q);
  if (!r.ok) return <p className="rounded-xl border border-dashed px-4 py-6 text-center text-muted-foreground text-sm">Numbers cannot be loaded right now. Please try again in a moment.</p>;
  if (!r.numbers.length) return <p className="rounded-xl border border-dashed px-4 py-6 text-center text-muted-foreground text-sm">{q ? "No numbers match those digits." : "No numbers are available right now."}</p>;
  const enabled = purchasesEnabled();
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {r.numbers.map((n) => (
        <li key={n.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="whitespace-nowrap font-heading font-semibold tabular-nums tracking-tight">{formatDid(n.did.length === 10 ? `91${n.did}` : n.did)}</p>
            <p className="text-muted-foreground text-xs">{NUMBER_PRICE_LABEL}/month</p>
          </div>
          <RentNumber id={n.id} did={n.did} label={formatDid(n.did.length === 10 ? `91${n.did}` : n.did)} agents={agents} enabled={enabled} />
        </li>
      ))}
    </ul>
  );
}
