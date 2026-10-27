import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion";
import { Section, SectionHeading } from "@/components/landing/section";

const faqs = [
  {
    q: "How is a minute counted?",
    a: "Each answered call is rounded up to the next full minute. A 45 second call is billed as 1 minute, and a 61 second call as 2 minutes. Calls that nobody answers are not charged.",
  },
  {
    q: "How do I pay?",
    a: "You keep a prepaid wallet in rupees and top it up with UPI or cards. Each call is deducted from that balance, and every deduction is listed on your wallet.",
  },
  {
    q: "What does the per-minute price include?",
    a: "The whole call: speech recognition, the AI model, the voice and the phone line. Renting a phone number is not part of the per-minute price.",
  },
  {
    q: "Can I see what each call cost?",
    a: "Yes. Every call page shows what the call cost, split across the AI model, the voice and speech recognition, so you can see your margin on each one.",
  },
  {
    q: "Which languages can my agent speak?",
    a: "Hindi, English, Telugu, Tamil, Bengali, Marathi, Kannada, Malayalam, Gujarati, Punjabi and Odia. The price is the same in every language.",
  },
];

export function PricingFaq() {
  return (
    <Section id="faq" className="border-t">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <SectionHeading eyebrow="Pricing FAQ" title="The details, answered." description="Still unsure about something? Create an account and try it with a real call." />
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
