import { BotIcon, PhoneCallIcon, RocketIcon } from "lucide-react";
import { Accent, Section, SectionHeading } from "./section";
import { Reveal } from "./reveal";

const steps = [
  {
    icon: BotIcon,
    title: "Describe your agent",
    body: "Start from a template or write what it should say. Pick a language and a voice. That is the whole setup.",
    mock: (
      <div className="space-y-1.5 text-[12px]">
        <div className="h-2 w-2/3 rounded-full bg-foreground/15" />
        <div className="h-2 w-full rounded-full bg-foreground/10" />
        <div className="h-2 w-5/6 rounded-full bg-foreground/10" />
        <div className="mt-3 flex gap-1.5">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">Hindi</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">Voice: Meera</span>
        </div>
      </div>
    ),
  },
  {
    icon: PhoneCallIcon,
    title: "Connect a number",
    body: "Point an Indian number at your agent, or have it call your customers. Test it by calling it yourself.",
    mock: (
      <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-[12px]">
        <span className="font-mono">+91 80 4••• ••12</span>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700">Connected</span>
      </div>
    ),
  },
  {
    icon: RocketIcon,
    title: "Go live",
    body: "Calls are answered instantly. Read transcripts, outcomes and spend from your dashboard.",
    mock: (
      <div className="flex h-12 items-end gap-1">
        {[30, 45, 38, 60, 52, 75, 68, 90].map((h, i) => (
          <span key={i} className="flex-1 rounded-t bg-gradient-to-t from-indigo-500 to-violet-400" style={{ height: `${h}%`, opacity: 0.4 + i * 0.075 }} />
        ))}
      </div>
    ),
  },
];

export function HowItWorks() {
  return (
    <Section id="how">
      <SectionHeading align="center" eyebrow="How it works" title={<>From idea to answered call in <Accent>an afternoon</Accent>.</>} />
      <div className="relative mt-16">
        <div aria-hidden className="absolute top-7 right-[16%] left-[16%] hidden h-px overflow-hidden bg-border md:block">
          <div className="travel h-full w-1/4 bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 120} className="relative text-center">
              <span className="relative mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_10px_30px_-10px_rgb(99_102_241/0.9)] ring-8 ring-background">
                <s.icon className="size-6" />
                <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-[#16162a] font-mono text-[11px] text-white">{i + 1}</span>
              </span>
              <h3 className="mt-6 font-heading font-semibold text-xl tracking-[-0.02em]">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-pretty text-muted-foreground text-sm leading-6">{s.body}</p>
              <div className="mx-auto mt-6 max-w-xs rounded-2xl border bg-card p-4 text-left shadow-black/[0.03] shadow-sm">{s.mock}</div>
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  );
}
