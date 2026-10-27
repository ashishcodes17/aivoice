import { ArrowRightIcon } from "lucide-react";
import { Accent, Section, SectionHeading } from "@/components/landing/section";
import { RATE_INR_PER_MINUTE, inrWhole } from "@/lib/pricing";

// Each call rounds up to the next full minute (the same rule the wallet uses).
const examples = [
  { length: "No answer", seconds: 0 },
  { length: "45 seconds", seconds: 45 },
  { length: "1 minute 10 seconds", seconds: 70 },
  { length: "5 minutes", seconds: 300 },
];

export function BillingExamples() {
  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
        <SectionHeading
          eyebrow="How billing works"
          title={
            <>
              Every call rounds up to the next <Accent>full</Accent> minute.
            </>
          }
          description="Calls nobody answers cost nothing. Answered calls are billed per started minute, so you always know the price in advance."
        />
        <div className="overflow-hidden rounded-2xl border">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b bg-muted/40 px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-[0.1em]">
            <span>Call length</span>
            <span className="text-right">Billed</span>
            <span className="w-16 text-right">You pay</span>
          </div>
          {examples.map((e) => {
            const minutes = Math.ceil(e.seconds / 60);
            return (
              <div key={e.length} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b px-6 py-4 text-sm last:border-b-0">
                <span className="font-medium">{e.length}</span>
                <span className="flex items-center justify-end gap-2 text-muted-foreground tabular-nums">
                  <ArrowRightIcon className="size-3.5" />
                  {minutes} {minutes === 1 ? "minute" : "minutes"}
                </span>
                <span className="w-16 text-right font-medium tabular-nums">{inrWhole(minutes * RATE_INR_PER_MINUTE)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
