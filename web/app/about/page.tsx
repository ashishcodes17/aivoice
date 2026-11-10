import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRightIcon, LanguagesIcon, PhoneCallIcon, ShieldCheckIcon, ZapIcon } from "lucide-react";
import { Cta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { Header } from "@/components/landing/header";
import { JsonLd } from "@/components/landing/json-ld";
import { Section, SectionHeading } from "@/components/landing/section";
import { Button } from "@/components/ui/button";
import { absolute, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "Lynksy builds AI voice agents that talk to people on the phone in the languages India actually speaks.",
  alternates: { canonical: "/about" },
};

const principles = [
  { icon: LanguagesIcon, title: "Language first", body: "India speaks hundreds of languages and mixes them freely. An agent should answer in the language the caller chose, not the one that was easiest to build." },
  { icon: ZapIcon, title: "Fast enough to feel human", body: "A pause that is too long breaks a conversation. We stream speech and replies so callers are answered quickly and can interrupt naturally." },
  { icon: ShieldCheckIcon, title: "Reliable and responsible", body: "Providers fail, so we build backups. Calls are conversations with real people, so we build for consent, clear hand-offs and honest limits." },
  { icon: PhoneCallIcon, title: "Built for the phone", body: "Most of India still does business by phone. We meet people there, with Indian numbers and rupee pricing." },
];

export default function AboutPage() {
  return (
    <>
      <Header />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: SITE.name,
          url: SITE.url,
          description: SITE.tagline,
          email: SITE.contactEmail,
          areaServed: "IN",
        }}
      />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_srgb,var(--primary)_10%,transparent),transparent)]" />
          <div className="mx-auto max-w-4xl px-6 py-20 text-center sm:py-28">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">About {SITE.name}</p>
            <h1 className="mt-5 text-balance font-heading font-semibold text-4xl leading-[1.05] tracking-[-0.04em] sm:text-6xl">
              Voice agents that speak the way <span className="font-normal font-serif text-primary italic tracking-normal">India</span> speaks.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground leading-8">
              We build software that lets any business answer and place phone calls with an AI agent, in Hindi, Tamil, Telugu, Hinglish and more, at any hour.
            </p>
          </div>
        </section>

        <Section>
          <div className="grid gap-12 lg:grid-cols-2">
            <SectionHeading eyebrow="Why we exist" title="Phones are how India does business. Most businesses can’t pick up every call." />
            <div className="space-y-5 text-muted-foreground leading-8">
              <p>
                A clinic misses calls when the reception is busy. A lender can’t phone every customer before a due date. A shop loses an order because nobody answered after 8 pm. Hiring more people for every language and every hour isn’t realistic for most businesses.
              </p>
              <p>
                Voice AI has become good enough to help, but most tools are built for English first and treat Indian languages as an afterthought. We started {SITE.name} to put that the other way round: Indian languages, Indian phone numbers and rupee pricing from day one.
              </p>
              <p>
                You write what your agent should do, choose a language and a voice, connect a number, and it takes calls. Every conversation comes with a transcript and an outcome, so you always know what happened.
              </p>
            </div>
          </div>
        </Section>

        <Section className="border-y bg-muted/30">
          <SectionHeading eyebrow="What we believe" title="Four principles behind the product" align="center" />
          <div className="mt-14 grid gap-5 sm:grid-cols-2">
            {principles.map((p) => (
              <div key={p.title} className="rounded-2xl border bg-card p-6">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/8 text-primary">
                  <p.icon className="size-5" />
                </span>
                <h3 className="mt-5 font-heading font-semibold text-lg tracking-tight">{p.title}</h3>
                <p className="mt-2 text-muted-foreground text-sm leading-6">{p.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section>
          <SectionHeading eyebrow="Get in touch" title="Questions, feedback or a use case you want to discuss?" description={`Write to us at ${SITE.contactEmail}. We read everything.`} />
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" render={<Link href="/signup" />}>
              Start building <ArrowRightIcon />
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/blog" />}>
              Read the blog
            </Button>
          </div>
        </Section>
        <Cta />
      </main>
      <Footer />
    </>
  );
}
