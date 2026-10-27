import { Accent, Section, SectionHeading } from "./section";

const steps = [
  {
    n: "01",
    title: "Create an agent",
    body: "Write a prompt, set the greeting, then pick a language and a voice. That is the whole configuration.",
  },
  {
    n: "02",
    title: "Connect a number",
    body: "Point an Indian phone number at your agent. Calls to that number are answered by it from then on.",
  },
  {
    n: "03",
    title: "Go live",
    body: "Callers are answered instantly. Review transcripts, calls and spend from your dashboard.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how">
      <SectionHeading
        eyebrow="How it works"
        title={
          <>
            From prompt to phone call in <Accent>three</Accent> steps.
          </>
        }
      />
      <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-0">
        {steps.map((s, i) => (
          <li
            key={s.n}
            className={
              "relative md:px-8 " +
              (i === 0 ? "md:pl-0 " : "md:border-l ") +
              (i === steps.length - 1 ? "md:pr-0" : "")
            }
          >
            <span className="font-mono text-muted-foreground text-sm tabular-nums">{s.n}</span>
            <h3 className="mt-4 font-heading font-semibold text-xl tracking-[-0.02em]">{s.title}</h3>
            <p className="mt-3 text-pretty text-muted-foreground text-sm leading-6">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
