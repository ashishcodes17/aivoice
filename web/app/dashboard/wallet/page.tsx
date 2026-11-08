import { Suspense } from "react";
import { AlertTriangleIcon, ArrowDownLeftIcon, ArrowUpRightIcon, CheckCircle2Icon } from "lucide-react";
import { LedgerList } from "@/components/dashboard/ledger-list";
import { Page, PageFallback, PageHeader } from "@/components/dashboard/page-header";
import { TopUp } from "@/components/dashboard/top-up";
import { requireOrg } from "@/lib/dashboard";
import { rupees } from "@/lib/format";
import type { LedgerEntry } from "@/lib/types";

export const metadata = { title: "Wallet" };

const LOW_PAISE = 10000; // under Rs 100

export default function WalletPage() {
  return (
    <Page>
      <PageHeader title="Wallet" description="Calls are billed per minute from your prepaid balance." />
      <Suspense fallback={<PageFallback />}>
        <Wallet />
      </Suspense>
    </Page>
  );
}

async function Wallet() {
  const { supabase, org } = await requireOrg();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [bal, ledger, month] = await Promise.all([
    supabase.from("wallet_balances").select("balance_paise").eq("org_id", org.id).maybeSingle(),
    supabase
      .from("wallet_ledger")
      .select("id, kind, amount_paise, note, created_at")
      .eq("org_id", org.id)
      .order("id", { ascending: false })
      .limit(50),
    supabase.from("wallet_ledger").select("amount_paise").eq("org_id", org.id).gte("created_at", since).limit(5000),
  ]);
  const entries = (ledger.data ?? []) as LedgerEntry[];
  const balance = Number(bal.data?.balance_paise ?? 0);
  const rows = month.data ?? [];
  const added = rows.filter((r) => r.amount_paise > 0).reduce((s, r) => s + r.amount_paise, 0);
  const spent = rows.filter((r) => r.amount_paise < 0).reduce((s, r) => s - r.amount_paise, 0);
  const state =
    balance < 0
      ? { label: "Overdrawn", pill: "bg-destructive/10 text-destructive-foreground", amount: "text-destructive-foreground", strip: "border-destructive/25 bg-destructive/5", stripIcon: "text-destructive-foreground", message: `You owe ${rupees(-balance)}. Agents can't answer calls until you top up.`, icon: AlertTriangleIcon, action: true }
      : balance < LOW_PAISE
        ? { label: "Running low", pill: "bg-warning/15 text-warning-foreground", amount: "text-foreground", strip: "border-warning/30 bg-warning/10", stripIcon: "text-warning-foreground", message: "Top up soon so your agents keep answering calls.", icon: AlertTriangleIcon, action: true }
        : { label: "Healthy", pill: "bg-success/10 text-success-foreground", amount: "text-foreground", strip: "", stripIcon: "", message: "", icon: CheckCircle2Icon, action: false };

  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_1fr]">
        <section className="rounded-2xl border bg-card shadow-black/[0.03] shadow-xs">
          <div className="p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-sm">Available balance</p>
              <span className={`rounded-full px-2.5 py-0.5 font-medium text-xs ${state.pill}`}>{state.label}</span>
            </div>
            <p className={`mt-2 font-heading font-semibold text-4xl tabular-nums tracking-[-0.035em] sm:text-5xl ${state.amount}`}>{rupees(balance)}</p>

            {state.message && (
              <div className={`mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3.5 py-3 text-sm ${state.strip}`}>
                <state.icon className={`size-4 shrink-0 ${state.stripIcon}`} />
                <p className="min-w-0 flex-1">{state.message}</p>
                {state.action && (
                  <a href="#add-funds" className="font-medium underline underline-offset-4">
                    Add funds
                  </a>
                )}
              </div>
            )}
          </div>

          <dl className="grid grid-cols-2 divide-x border-t">
            <div className="px-5 py-4 sm:px-7">
              <dt className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <ArrowDownLeftIcon className="size-3.5 text-success-foreground" /> Added, last 30 days
              </dt>
              <dd className="mt-1 truncate font-heading font-semibold text-lg tabular-nums tracking-tight">{rupees(added)}</dd>
            </div>
            <div className="px-5 py-4 sm:px-7">
              <dt className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <ArrowUpRightIcon className="size-3.5" /> Spent, last 30 days
              </dt>
              <dd className="mt-1 truncate font-heading font-semibold text-lg tabular-nums tracking-tight">{rupees(spent)}</dd>
            </div>
          </dl>
        </section>

        <section id="add-funds" className="scroll-mt-24 rounded-2xl border bg-card p-5 sm:p-6">
          <h2 className="font-heading font-semibold text-lg tracking-tight">Add funds</h2>
          <p className="mt-0.5 mb-5 text-muted-foreground text-sm">Choose an amount. It reaches your wallet within moments.</p>
          <TopUp orgId={org.id} balancePaise={balance} />
        </section>
      </div>

      <LedgerList entries={entries} />
    </>
  );
}
