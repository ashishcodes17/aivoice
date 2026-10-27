import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion";
import { Section, SectionHeading } from "./section";

const faqs = [
  {
    q: "Which languages are supported?",
    a: "Hindi, English and a growing list of Indian languages including Tamil, Telugu, Bengali, Marathi, Kannada, Malayalam, Gujarati, Punjabi and Odia. You set the language per agent.",
  },
  {
    q: "Can I use my own phone number?",
    a: "Agents run on Indian phone numbers provisioned through our telephony partner. Each number is mapped to one agent, and you can change that mapping at any time.",
  },
  {
    q: "How does billing work?",
    a: "You keep a prepaid wallet in rupees and top it up with UPI or cards. Each call is billed per started minute, and every debit appears on your wallet ledger.",
  },
  {
    q: "Which AI models can my agent use?",
    a: "Any model available through OpenRouter. You choose the model per agent, so you can trade cost against quality for each use case.",
  },
  {
    q: "Is my data kept separate from other customers?",
    a: "Yes. Every organisation's agents, calls and transcripts are isolated at the database level with row-level security, so one account can never read another's data.",
  },
];

export function Faq() {
  return (
    <Section id="faq" className="border-t">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <SectionHeading eyebrow="FAQ" title="Questions, answered." description="Anything else? Reach out once you have an account and we will help." />
        <Accordion>
          {faqs.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="py-5 text-base">{f.q}</AccordionTrigger>
              <AccordionPanel>
                <p className="max-w-xl text-pretty leading-6">{f.a}</p>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}
