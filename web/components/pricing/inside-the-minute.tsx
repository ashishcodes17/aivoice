import { AudioLinesIcon, BotIcon, FileTextIcon, GaugeIcon, MicIcon, PhoneIcon } from "lucide-react";
import { Accent, Section, SectionHeading } from "@/components/landing/section";

const parts = [
  { icon: MicIcon, title: "Speech recognition", body: "Understands callers in Indian languages, as they speak." },
  { icon: BotIcon, title: "The AI model", body: "The model that works out what your agent should say." },
  { icon: AudioLinesIcon, title: "The voice", body: "Natural speech in the language you choose." },
  { icon: PhoneIcon, title: "The phone line", body: "The call itself, whether it comes in or goes out." },
  { icon: FileTextIcon, title: "Transcripts", body: "Every conversation, written down and kept with its call." },
  { icon: GaugeIcon, title: "Cost per call", body: "See exactly what each call cost, split by part." },
];

export function InsideTheMinute() {
  return (
    <Section className="border-y bg-muted/30">
      <SectionHeading
        eyebrow="What you get"
        title={
          <>
            One price, with <Accent>everything</Accent> inside it.
          </>
        }
        description="No separate bills for speech, models or phone lines. The per-minute price covers the whole call."
      />
      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {parts.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-background p-7">
            <div className="flex size-9 items-center justify-center rounded-lg border bg-card shadow-black/[0.04] shadow-xs">
              <Icon className="size-4" strokeWidth={1.75} />
            </div>
            <h3 className="mt-5 font-heading font-medium text-base tracking-tight">{title}</h3>
            <p className="mt-1.5 text-pretty text-muted-foreground text-sm leading-6">{body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
