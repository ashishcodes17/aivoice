import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRightIcon } from "lucide-react";
import { Cta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { Header } from "@/components/landing/header";
import { Section } from "@/components/landing/section";
import { solutions } from "@/lib/solutions";

export const metadata: Metadata = {
  title: "Solutions",
  description: "AI voice agents for financial services, healthcare, e-commerce, logistics, real estate and travel, in Indian languages.",
};

export default function SolutionsPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Section className="pb-8 sm:pb-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">Solutions</p>
            <h1 className="mt-4 text-balance font-heading font-semibold text-4xl leading-[1.05] tracking-[-0.04em] sm:text-6xl">
              A voice agent for every <span className="font-normal font-serif text-primary italic tracking-normal">phone-heavy</span> industry.
            </h1>
            <p className="mt-6 text-pretty text-lg text-muted-foreground leading-8">
              The same platform, set up for the calls your business makes and takes every day, in the language your customers speak.
            </p>
          </div>
        </Section>
        <Section className="pt-0 sm:pt-0">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {solutions.map((s) => (
              <Link key={s.slug} href={`/solutions/${s.slug}`} className="group flex flex-col rounded-2xl border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-sm">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/8 text-primary">
                  <s.icon className="size-5" />
                </span>
                <h2 className="mt-5 font-heading font-semibold text-lg tracking-tight">{s.name}</h2>
                <p className="mt-2 flex-1 text-muted-foreground text-sm leading-6">{s.summary}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 font-medium text-primary text-sm">
                  Learn more <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </Section>
        <Cta />
      </main>
      <Footer />
    </>
  );
}
