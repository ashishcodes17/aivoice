import Link from "next/link";
import { Suspense } from "react";
import { BotIcon, MessageCircleIcon, MicIcon, Trash2Icon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Page, PageFallback, PageHeader } from "@/components/dashboard/page-header";
import { WhatsappForm } from "@/components/dashboard/whatsapp-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { removeWhatsapp, setWhatsappEnabled } from "@/app/dashboard/actions";
import { requireOrg } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format";
import type { WhatsappAccount, WhatsappMessage } from "@/lib/types";

export const metadata = { title: "WhatsApp" };

export default function WhatsappPage() {
  return (
    <Page>
      <PageHeader title="WhatsApp" description="Customers text or send voice notes; your agent answers in the same way." />
      <Suspense fallback={<PageFallback />}>
        <Whatsapp />
      </Suspense>
    </Page>
  );
}

async function Whatsapp() {
  const { supabase, org } = await requireOrg();
  const [agentsRes, accountsRes, messagesRes] = await Promise.all([
    supabase.from("agents").select("id, name").eq("org_id", org.id).order("name"),
    supabase
      .from("whatsapp_accounts")
      .select("id, phone_number_id, display_number, enabled, created_at, agents(name)")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("whatsapp_messages")
      .select("id, account_id, contact_number, contact_name, direction, kind, content, created_at")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const agents = (agentsRes.data ?? []).map((a) => ({ value: a.id as string, label: a.name as string }));
  const accounts = (accountsRes.data ?? []) as unknown as WhatsappAccount[];
  const messages = (messagesRes.data ?? []) as unknown as (WhatsappMessage & { account_id: string })[];

  if (!agents.length) {
    return (
      <EmptyState icon={BotIcon} title="Create an agent first" description="A WhatsApp number needs an agent to answer its messages.">
        <Button render={<Link href="/dashboard/agents/new" />}>New agent</Button>
      </EmptyState>
    );
  }

  // One row per customer: the newest message, newest conversation first.
  const threads = new Map<string, (typeof messages)[number]>();
  for (const m of messages) {
    const key = `${m.account_id}/${m.contact_number}`;
    if (!threads.has(key)) threads.set(key, m);
  }

  const base = process.env.NEXT_PUBLIC_WORKER_URL?.replace(/\/$/, "") ?? "https://<your-worker-domain>";

  return (
    <>
      <WhatsappForm agents={agents} webhookUrl={`${base}/wa/webhook`} />

      {accounts.length > 0 && (
        <div className="divide-y overflow-hidden rounded-xl border">
          {accounts.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium text-sm">{a.display_number || `ID ${a.phone_number_id}`}</p>
                <p className="text-muted-foreground text-xs">
                  Answered by {a.agents?.name ?? "no agent"} · connected {formatDateTime(a.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={a.enabled ? "success" : "secondary"}>{a.enabled ? "Replying" : "Paused"}</Badge>
                <form action={setWhatsappEnabled.bind(null, a.id, !a.enabled)}>
                  <Button type="submit" variant="outline" size="sm">
                    {a.enabled ? "Pause" : "Resume"}
                  </Button>
                </form>
                <form action={removeWhatsapp.bind(null, a.id)}>
                  <Button type="submit" variant="ghost" size="icon-xs" aria-label="Disconnect number">
                    <Trash2Icon />
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {threads.size > 0 ? (
        <div className="space-y-2">
          <h2 className="font-medium text-sm">Conversations</h2>
          <div className="divide-y overflow-hidden rounded-xl border">
            {[...threads.entries()].map(([key, m]) => (
              <Link
                key={key}
                href={`/dashboard/whatsapp/${m.account_id}/${m.contact_number}`}
                className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm">
                    {m.contact_name || `+${m.contact_number}`}
                    {m.contact_name && <span className="ml-2 font-normal text-muted-foreground tabular-nums">+{m.contact_number}</span>}
                  </p>
                  <p className="flex items-center gap-1.5 truncate text-muted-foreground text-xs">
                    {m.kind === "audio" && <MicIcon className="size-3 shrink-0" />}
                    {m.direction === "outbound" && "Agent: "}
                    {m.content || "Voice note"}
                  </p>
                </div>
                <span className="shrink-0 text-muted-foreground text-xs">{formatDateTime(m.created_at)}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        accounts.length > 0 && (
          <EmptyState icon={MessageCircleIcon} title="No messages yet" description="Send a text or voice note to the connected number and the conversation shows up here." />
        )
      )}
    </>
  );
}
