import { CheckIcon, XIcon } from "lucide-react";
import { Accent, Section, SectionHeading } from "./section";
import { Reveal } from "./reveal";

const BEFORE = [
  "Calls ring out after 6 PM and on Sundays",
  "Leads wait hours for a callback, then buy elsewhere",
  "Staff repeat the same five answers all day",
  "A Tamil caller reaches a Hindi-only team",
  "No record of what was promised on the call",
];
const AFTER = [
  "Every call answered on the first ring, day and night",
  "New enquiries called back in minutes, automatically",
  "Your team only takes the calls that need a person",
  "The agent replies in the caller's own language",
  "Transcript, outcome and cost saved for every call",
];

export function BeforeAfter() {
  return (
    <Section className="border-t">
      <SectionHeading
        align="center"
        eyebrow="The difference"
        title={<>Same phone line. A very <Accent>different</Accent> month.</>}
      />
      <div className="mt-14 grid gap-5 md:grid-cols-2">
        <Reveal className="rounded-3xl border bg-[#fbfafa] p-7 sm:p-9">
          <p className="font-medium text-muted-foreground text-sm">Without an agent</p>
          <ul className="mt-6 space-y-4">
            {BEFORE.map((t) => (
              <li key={t} className="flex items-start gap-3 text-[15px] text-muted-foreground leading-6">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <XIcon className="size-3" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={120} className="relative overflow-hidden rounded-3xl bg-[#0d0b24] p-7 text-white sm:p-9">
          <div aria-hidden className="absolute -top-24 -right-24 size-72 rounded-full bg-[radial-gradient(circle,rgb(99_102_241/0.5),transparent_65%)] blur-2xl" />
          <div aria-hidden className="absolute -bottom-28 -left-20 size-72 rounded-full bg-[radial-gradient(circle,rgb(249_115_82/0.3),transparent_65%)] blur-2xl" />
          <p className="relative font-medium text-indigo-200 text-sm">With Lynksy</p>
          <ul className="relative mt-6 space-y-4">
            {AFTER.map((t) => (
              <li key={t} className="flex items-start gap-3 text-[15px] leading-6">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                  <CheckIcon className="size-3" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}
