import {
  ArrowRightIcon,
  BotIcon,
  FileTextIcon,
  PhoneIncomingIcon,
  PhoneOutgoingIcon,
  SlidersHorizontalIcon,
  WalletIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Accent, Section, SectionHeading } from "./section";
import { Reveal } from "./reveal";

function Card({ className, icon: Icon, title, body, children, delay = 0 }: {
  className?: string;
  icon: typeof BotIcon;
  title: string;
  body: string;
  children?: React.ReactNode;
  delay?: number;
}) {
  return (
    <Reveal
      delay={delay}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border bg-card p-6 transition-shadow duration-300 hover:shadow-[0_20px_60px_-25px_rgb(79_70_229/0.35)] sm:p-7",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 [background:radial-gradient(60%_50%_at_50%_0%,rgb(99_102_241/0.08),transparent)]" />
      <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_6px_16px_-6px_rgb(99_102_241/0.8)]">
        <Icon className="size-[18px]" />
      </span>
      <h3 className="mt-5 font-heading font-semibold text-lg tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-md text-pretty text-muted-foreground text-sm leading-6">{body}</p>
      {children && <div className="relative mt-6 flex-1">{children}</div>}
    </Reveal>
  );
}

function NumbersVisual() {
  const rows = [
    { n: "+91 80 4••• ••12", agent: "Front desk", icon: PhoneIncomingIcon, tone: "bg-emerald-500" },
    { n: "+91 22 6••• ••90", agent: "Sales caller", icon: PhoneOutgoingIcon, tone: "bg-indigo-500" },
    { n: "+91 44 7••• ••58", agent: "Tamil support", icon: PhoneIncomingIcon, tone: "bg-orange-500" },
  ];
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.n} className="flex items-center gap-3 rounded-xl border bg-background px-3.5 py-2.5 text-sm">
          <r.icon className="size-4 text-muted-foreground" />
          <span className="font-mono text-[13px]">{r.n}</span>
          <ArrowRightIcon className="size-3.5 text-muted-foreground/60" />
          <span className="ml-auto flex items-center gap-2 font-medium">
            <i className={cn("size-2 rounded-full", r.tone)} />
            {r.agent}
          </span>
        </div>
      ))}
    </div>
  );
}

function ModelsVisual() {
  const models = ["gpt-4o-mini", "claude", "gemini", "llama", "sarvam-m", "mistral"];
  return (
    <div className="flex flex-wrap gap-2">
      {models.map((m, i) => (
        <span
          key={m}
          className={cn(
            "rounded-full border px-3 py-1 font-mono text-xs",
            i === 0 ? "border-primary/40 bg-primary/10 text-primary" : "bg-background text-muted-foreground",
          )}
        >
          {m}
        </span>
      ))}
    </div>
  );
}

function TranscriptVisual() {
  return (
    <div className="space-y-2 rounded-xl border bg-background p-3.5 text-[13px] leading-5">
      <p><span className="font-medium text-primary">Agent</span> <span className="text-muted-foreground">Which day suits you for the site visit?</span></p>
      <p><span className="font-medium text-coral">Caller</span> <span className="text-muted-foreground">Sunday morning, around 11.</span></p>
      <div className="flex flex-wrap gap-1.5 border-t pt-2.5">
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700">Visit requested</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Sun · 11 AM</span>
      </div>
    </div>
  );
}

function WalletVisual() {
  const rows = [
    { label: "Top-up via UPI", amt: "+₹2,000", tone: "text-emerald-600" },
    { label: "Call · 3 min", amt: "−₹9", tone: "text-foreground" },
    { label: "Call · 1 min", amt: "−₹3", tone: "text-foreground" },
  ];
  return (
    <div className="divide-y rounded-xl border bg-background text-sm" title="Example amounts">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between px-3.5 py-2.5">
          <span className="text-muted-foreground">{r.label}</span>
          <span className={cn("font-mono tabular-nums", r.tone)}>{r.amt}</span>
        </div>
      ))}
    </div>
  );
}

function WhatsAppVisual() {
  return (
    <div className="space-y-2 text-[13px]">
      <p className="w-fit max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-3 py-2">Kal ka slot available hai?</p>
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-md bg-emerald-500 px-3 py-2 text-white">Haan ji, kal shaam 5 baje free hai. Book kar doon?</p>
    </div>
  );
}

export function Features() {
  return (
    <Section id="product" className="bg-[#faf9fd]">
      <SectionHeading
        eyebrow="Platform"
        title={<>Everything a phone agent needs, <Accent>nothing</Accent> it doesn&apos;t.</>}
        description="One platform from the phone line to the transcript, so you ship a working agent instead of wiring five vendors together."
      />
      <div className="mt-14 grid gap-4 md:grid-cols-6">
        <Card className="md:col-span-4" icon={PhoneIncomingIcon} title="Your own Indian numbers" body="Answer and place calls on Indian numbers. Each number goes to the agent you choose, and you can change it any time.">
          <NumbersVisual />
        </Card>
        <Card className="md:col-span-2" delay={80} icon={SlidersHorizontalIcon} title="Pick any model" body="Hundreds of language models through OpenRouter, chosen per agent.">
          <ModelsVisual />
        </Card>
        <Card className="md:col-span-3" delay={0} icon={FileTextIcon} title="Every call, on record" body="Transcript, outcome and the details collected, saved with the call.">
          <TranscriptVisual />
        </Card>
        <Card className="md:col-span-3" delay={160} icon={WalletIcon} title="Pay as you talk" body="A rupee wallet topped up with UPI or cards, and a ledger line for every call.">
          <WalletVisual />
        </Card>
      </div>
    </Section>
  );
}
