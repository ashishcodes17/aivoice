import {
  AudioLinesIcon,
  FileTextIcon,
  LanguagesIcon,
  PhoneIcon,
  SlidersHorizontalIcon,
  WalletIcon,
} from "lucide-react";
import { Accent, Section, SectionHeading } from "./section";

const features = [
  {
    icon: AudioLinesIcon,
    title: "Natural conversations",
    body: "Streaming speech recognition, a language model of your choice and expressive speech synthesis, tuned for the low delay that phone calls demand.",
  },
  {
    icon: LanguagesIcon,
    title: "Built for India",
    body: "Hindi, Tamil, Telugu, Bengali, Marathi and more. Callers speak the way they naturally do, and your agent answers in kind.",
  },
  {
    icon: PhoneIcon,
    title: "Your own numbers",
    body: "Answer and place calls on Indian phone numbers, with each number routed to the agent you choose.",
  },
  {
    icon: SlidersHorizontalIcon,
    title: "Pick your model",
    body: "Choose from hundreds of language models per agent through OpenRouter, and change it without touching your setup.",
  },
  {
    icon: FileTextIcon,
    title: "Transcripts for every call",
    body: "Each conversation is transcribed and stored with its call, so you can review exactly what your agent said.",
  },
  {
    icon: WalletIcon,
    title: "Pay for what you use",
    body: "Top up a wallet in rupees with UPI or cards. Calls are billed per minute, and every debit is recorded on a ledger.",
  },
];

export function Features() {
  return (
    <Section id="product">
      <SectionHeading
        eyebrow="Platform"
        title={
          <>
            Everything a phone agent needs, <Accent>nothing</Accent> it doesn&apos;t.
          </>
        }
        description="One platform from the phone line to the transcript, so you can ship a working voice agent instead of wiring five vendors together."
      />
      <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-background p-8 transition-colors hover:bg-muted/40">
            <div className="flex size-10 items-center justify-center rounded-lg border bg-card shadow-black/[0.04] shadow-xs">
              <Icon className="size-[18px] text-foreground" strokeWidth={1.75} />
            </div>
            <h3 className="mt-6 font-heading font-medium text-base tracking-tight">{title}</h3>
            <p className="mt-2 text-pretty text-muted-foreground text-sm leading-6">{body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
