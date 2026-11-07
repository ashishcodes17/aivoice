import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, MicIcon } from "lucide-react";
import { Page, PageFallback, PageHeader } from "@/components/dashboard/page-header";
import { requireOrg } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WhatsappMessage } from "@/lib/types";

export const metadata = { title: "WhatsApp conversation" };

export default function ThreadPage({ params }: PageProps<"/dashboard/whatsapp/[account]/[contact]">) {
  return (
    <Page>
      <Suspense fallback={<PageFallback />}>
        <Thread params={params} />
      </Suspense>
    </Page>
  );
}

async function Thread({ params }: { params: PageProps<"/dashboard/whatsapp/[account]/[contact]">["params"] }) {
  const { account, contact } = await params;
  const { supabase, org } = await requireOrg();
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("id, contact_number, contact_name, direction, kind, content, created_at")
    .eq("org_id", org.id)
    .eq("account_id", account)
    .eq("contact_number", contact)
    .order("created_at", { ascending: true })
    .limit(500);
  const messages = (data ?? []) as WhatsappMessage[];
  if (!messages.length) notFound();
  const name = messages.find((m) => m.contact_name)?.contact_name;

  return (
    <>
      <Link href="/dashboard/whatsapp" className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> All conversations
      </Link>
      <PageHeader title={name || `+${contact}`} description={name ? `+${contact}` : "WhatsApp conversation"} />
      <div className="mx-auto flex max-w-2xl flex-col gap-2">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col", m.direction === "outbound" ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                m.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {m.kind === "audio" && (
                <span className="mb-1 flex items-center gap-1 text-xs opacity-70">
                  <MicIcon className="size-3" /> Voice note
                </span>
              )}
              {m.content || "(could not transcribe)"}
            </div>
            <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">{formatDateTime(m.created_at)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
