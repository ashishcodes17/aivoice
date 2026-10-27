import { Suspense } from "react";
import { WalletIcon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Page, PageFallback, PageHeader } from "@/components/dashboard/page-header";
import { TopUp } from "@/components/dashboard/top-up";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOrg } from "@/lib/dashboard";
import { formatDateTime, rupees } from "@/lib/format";
import type { LedgerEntry } from "@/lib/types";

export const metadata = { title: "Wallet" };

const kindLabel = { topup: "Top-up", call_debit: "Call usage", refund: "Refund", adjustment: "Adjustment" } as const;

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
  const [bal, ledger] = await Promise.all([
    supabase.from("wallet_balances").select("balance_paise").eq("org_id", org.id).maybeSingle(),
    supabase
      .from("wallet_ledger")
      .select("id, kind, amount_paise, note, created_at")
      .eq("org_id", org.id)
      .order("id", { ascending: false })
      .limit(50),
  ]);
  const entries = (ledger.data ?? []) as LedgerEntry[];

  return (
    <>
      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <div className="rounded-xl border bg-card p-6">
          <p className="text-muted-foreground text-sm">Available balance</p>
          <p className="mt-2 font-heading font-semibold text-4xl tabular-nums tracking-[-0.035em]">
            {rupees(Number(bal.data?.balance_paise ?? 0))}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 font-medium text-sm">Add funds</h2>
          <TopUp orgId={org.id} />
        </div>
      </div>

      <section>
        <h2 className="font-heading font-semibold text-base tracking-tight">Transactions</h2>
        <div className="mt-4">
          {entries.length ? (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(e.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant={e.amount_paise > 0 ? "success" : "secondary"}>{kindLabel[e.kind]}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{e.note ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {e.amount_paise > 0 ? "+" : "−"}
                        {rupees(Math.abs(e.amount_paise))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState icon={WalletIcon} title="No transactions yet" description="Top-ups and per-minute call charges will appear here." />
          )}
        </div>
      </section>
    </>
  );
}
