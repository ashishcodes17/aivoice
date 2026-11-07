import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRightIcon, CheckIcon, InfoIcon } from "lucide-react";
import { Cta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { Header } from "@/components/landing/header";
import { Section, SectionHeading } from "@/components/landing/section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { findSolution, solutions } from "@/lib/solutions";

export function generateStaticParams() {
  return solutions.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/solutions/[slug]">): Promise<Metadata> {
  const s = findSolution((await params).slug);
  if (!s) return {};
  return {
    title: `AI voice agents for ${s.name.toLowerCase()}`,
    description: s.summary + " Voice agents that speak Hindi, Tamil, Telugu and more, on Indian phone numbers.",
  };
}

export default async function SolutionPage({ params }: PageProps<"/solutions/[slug]">) {
  const s = findSolution((await params).slug);
  if (!s) notFound();
  const Icon = s.icon;
  const others = solutions.filter((o) => o.slug !== s.slug);

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_srgb,var(--primary)_10%,transparent),transparent)]"
          />
          <div className="mx-auto max-w-4xl px-6 py-20 text-center sm:py-28">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs">
              <Icon className="size-3.5 text-primary" /> {s.name}
            </span>
            <h1 className="mt-6 text-balance font-heading font-semibold text-4xl leading-[1.05] tracking-[-0.04em] sm:text-6xl">
              {s.title[0]}
              <span className="font-normal font-serif text-primary italic tracking-normal">{s.title[1]}</span>
              {s.title[2]}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground leading-8">{s.intro}</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button size="xl" render={<Link href="/signup" />}>
                Start building <ArrowRightIcon />
              </Button>
              <Button size="xl" variant="outline" render={<Link href="/#demo" />}>
                Hear a real call
              </Button>
            </div>
          </div>
        </section>

        <Section>
          <SectionHeading eyebrow="What your agent handles" title={`Everyday calls in ${s.name.toLowerCase()}`} />
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">
            {s.useCases.map((u) => (
              <div key={u.title} className="bg-card p-6">
                <h3 className="font-heading font-medium text-base tracking-tight">{u.title}</h3>
                <p className="mt-2 text-muted-foreground text-sm leading-6">{u.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section className="border-y bg-muted/30">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <SectionHeading eyebrow="Sample call" title="What a call can sound like" description="An illustrative script, not a customer recording. Your agent follows the prompt you write." />
              <ul className="mt-8 space-y-3">
                {s.captured.map((c) => (
                  <li key={c} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <CheckIcon className="size-3" strokeWidth={2.5} />
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-hidden rounded-2xl border bg-card shadow-black/[0.04] shadow-sm">
              <div className="flex items-center justify-between border-b px-5 py-3 text-sm">
                <span className="font-medium">{s.call.agent}</span>
                <span className="text-muted-foreground text-xs">{s.call.language}</span>
              </div>
              <div className="space-y-3 p-5">
                {s.call.lines.map((l, i) => (
                  <div key={i} className={cn("flex flex-col", l.who === "agent" ? "items-start" : "items-end")}>
                    <span className="mb-1 text-[10px] text-muted-foreground uppercase tracking-wider">{l.who}</span>
                    <p
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                        l.who === "agent" ? "rounded-tl-md bg-muted" : "rounded-tr-md bg-primary text-primary-foreground",
                      )}
                    >
                      {l.text}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t bg-muted/40 px-5 py-3 text-muted-foreground text-xs">
                Outcome: <span className="font-medium text-foreground">{s.call.outcome}</span>
              </div>
            </div>
          </div>
          {s.note && (
            <p className="mt-10 flex items-start gap-2.5 rounded-xl border bg-card p-4 text-muted-foreground text-sm leading-6">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              {s.note}
            </p>
          )}
        </Section>

        <Section>
          <SectionHeading eyebrow="More solutions" title="Built for every phone-heavy industry" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((o) => (
              <Link key={o.slug} href={`/solutions/${o.slug}`} className="group rounded-xl border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-sm">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <o.icon className="size-4.5" />
                </span>
                <h3 className="mt-4 font-heading font-medium text-sm">{o.name}</h3>
                <p className="mt-1 text-muted-foreground text-sm leading-6">{o.summary}</p>
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
