import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRightIcon } from "lucide-react";
import { Footer } from "@/components/landing/footer";
import { Header } from "@/components/landing/header";
import { JsonLd } from "@/components/landing/json-ld";
import { Section } from "@/components/landing/section";
import { formatDate, readingMinutes, sortedPosts } from "@/lib/blog";
import { absolute, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guides on building AI voice agents for phone calls in India: Hinglish, latency, turn-taking, prompts and compliance.",
  alternates: { canonical: "/blog" },
  openGraph: { title: `Blog | ${SITE.name}`, description: "Practical guides on AI voice agents for phone calls in India.", url: absolute("/blog"), type: "website" },
};

export default function BlogPage() {
  const posts = sortedPosts();
  const [lead, ...rest] = posts;
  return (
    <>
      <Header />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: `${SITE.name} blog`,
          url: absolute("/blog"),
          blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: absolute(`/blog/${p.slug}`), datePublished: p.date })),
        }}
      />
      <main className="flex-1">
        <Section className="pb-10 sm:pb-14">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">Blog</p>
          <h1 className="mt-4 max-w-3xl text-balance font-heading font-semibold text-4xl leading-[1.05] tracking-[-0.04em] sm:text-5xl">
            Building voice agents that <span className="font-normal font-serif text-primary italic tracking-normal">people</span> want to talk to.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground leading-8">
            Practical guides on Indian languages, latency, conversation design and running calls responsibly.
          </p>
        </Section>
        <Section className="pt-0 sm:pt-0">
          <Link href={`/blog/${lead.slug}`} className="group block rounded-2xl border bg-card p-7 transition-all hover:border-primary/30 hover:shadow-sm sm:p-10">
            <div className="flex items-center gap-3 text-muted-foreground text-xs">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary">{lead.tag}</span>
              <time dateTime={lead.date}>{formatDate(lead.date)}</time>
              <span>{readingMinutes(lead)} min read</span>
            </div>
            <h2 className="mt-4 max-w-3xl text-balance font-heading font-semibold text-3xl tracking-[-0.03em]">{lead.title}</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground leading-7">{lead.description}</p>
            <span className="mt-6 inline-flex items-center gap-1.5 font-medium text-primary text-sm">
              Read article <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {rest.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="group flex flex-col rounded-2xl border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-sm">
                <div className="flex items-center gap-3 text-muted-foreground text-xs">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary">{p.tag}</span>
                  <time dateTime={p.date}>{formatDate(p.date)}</time>
                </div>
                <h2 className="mt-4 text-balance font-heading font-semibold text-xl tracking-tight">{p.title}</h2>
                <p className="mt-2 flex-1 text-muted-foreground text-sm leading-6">{p.description}</p>
                <span className="mt-4 text-muted-foreground text-xs">{readingMinutes(p)} min read</span>
              </Link>
            ))}
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
