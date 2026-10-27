import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { CostBreakdown } from "@/components/dashboard/cost-breakdown";
import { Page, PageFallback } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { requireOrg } from "@/lib/dashboard";
import { duration, formatDateTime, rupees } from "@/lib/format";
import type { Call } from "@/lib/types";

export const metadata = { title: "Call" };

export default function CallPage({ params }: PageProps<"/dashboard/calls/[id]">) {
  return (
    <Page>
      <Link href="/dashboard/calls" className="flex w-fit items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        Calls
      </Link>
      <Suspense fallback={<PageFallback />}>
        <Detail params={params} />
      </Suspense>
    </Page>
  );
}

async function Detail({ params }: { params: PageProps<"/dashboard/calls/[id]">["params"] }) {
  const { id } = await params;
  const { supabase, org } = await requireOrg();
  const [callRes, linesRes] = await Promise.all([
    supabase
      .from("calls")
      .select("id, direction, status, from_number, to_number, duration_seconds, cost_paise, created_at, metadata, agents(name)")
      .eq("id", id)
      .eq("org_id", org.id)
      .maybeSingle(),
    supabase.from("call_transcripts").select("id, role, content").eq("call_id", id).order("id"),
  ]);
  if (!callRes.data) notFound();
  const call = callRes.data as unknown as Call;
  const lines = linesRes.data ?? [];

  const facts = [
    ["Direction", call.direction],
    ["From", call.from_number ?? "—"],
    ["To", call.to_number ?? "—"],
    ["Agent", call.agents?.name ?? "—"],
    ["Duration", duration(call.duration_seconds)],
    ["Cost", rupees(call.cost_paise)],
  ];

  return (
    <>
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-heading font-semibold text-2xl tracking-[-0.03em]">Call</h1>
          <Badge variant="outline" className="capitalize">
            {call.status}
          </Badge>
        </div>
        <p className="mt-1.5 text-muted-foreground text-sm">{formatDateTime(call.created_at)}</p>
      </div>

      <dl className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="bg-card p-4">
            <dt className="text-muted-foreground text-xs">{k}</dt>
            <dd className="mt-1 font-medium text-sm capitalize tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      {call.metadata?.cost && <CostBreakdown cost={call.metadata.cost} chargedPaise={call.cost_paise} />}

      <section>
        <h2 className="font-heading font-semibold text-base tracking-tight">Transcript</h2>
        {lines.length ? (
          <div className="mt-4 max-w-2xl space-y-4">
            {lines.map((l) => (
              <div key={l.id} className={l.role === "user" ? "flex justify-end" : "flex"}>
                <div className="max-w-[88%]">
                  <p className={"mb-1.5 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.12em] " + (l.role === "user" ? "text-right" : "")}>
                    {l.role === "user" ? "Caller" : "Agent"}
                  </p>
                  <p
                    className={
                      "rounded-2xl px-4 py-2.5 text-sm leading-6 " +
                      (l.role === "user" ? "rounded-tr-md bg-primary text-primary-foreground" : "rounded-tl-md bg-muted")
                    }
                  >
                    {l.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-muted-foreground text-sm">No transcript was recorded for this call.</p>
        )}
      </section>
    </>
  );
}
