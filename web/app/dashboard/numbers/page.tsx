import Link from "next/link";
import { Suspense } from "react";
import { BotIcon, PhoneIcon, Trash2Icon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { CallbackForm } from "@/components/dashboard/callback-form";
import { NumberForm } from "@/components/dashboard/number-form";
import { Page, PageFallback, PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { removeNumber } from "@/app/dashboard/actions";
import { requireOrg } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format";
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

  const callable = numbers
    .filter((n) => n.agent_id)
    .map((n) => ({ value: n.id, label: `+${n.did_number} → ${n.agents?.name ?? "agent"}` }));

  return (
    <>
      <NumberForm agents={agents} />
      {callable.length > 0 && <CallbackForm numbers={callable} agents={agents} />}
      {numbers.length ? (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Connected</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {numbers.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium tabular-nums">+{n.did_number}</TableCell>
                  <TableCell className="text-muted-foreground">{n.agents?.name ?? "No agent"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(n.created_at)}</TableCell>
                  <TableCell>
                    <form action={removeNumber.bind(null, n.id)}>
                      <Button type="submit" variant="ghost" size="icon-xs" aria-label={`Disconnect ${n.did_number}`}>
                        <Trash2Icon />
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={PhoneIcon} title="No numbers connected" description="Add a number above and route it to your telephony provider's voice endpoint." />
      )}
    </>
  );
}
