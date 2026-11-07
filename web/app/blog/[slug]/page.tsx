import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Cta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { Header } from "@/components/landing/header";
import { JsonLd } from "@/components/landing/json-ld";
import { headings, Prose } from "@/components/landing/prose";
import { Button } from "@/components/ui/button";
import { findPost, formatDate, posts, readingMinutes, sortedPosts } from "@/lib/blog";
import { absolute, SITE } from "@/lib/site";

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = findPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.description, url: absolute(`/blog/${post.slug}`), publishedTime: post.date, authors: [SITE.name] },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}

export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const post = findPost((await params).slug);
  if (!post) notFound();
  const toc = headings(post.blocks);
  const related = sortedPosts().filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <>
      <Header />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BlogPosting",
              headline: post.title,
              description: post.description,
              datePublished: post.date,
              dateModified: post.date,
              mainEntityOfPage: absolute(`/blog/${post.slug}`),
              author: { "@type": "Organization", name: SITE.name, url: SITE.url },
              publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
              articleSection: post.tag,
              inLanguage: "en-IN",
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: absolute("/") },
                { "@type": "ListItem", position: 2, name: "Blog", item: absolute("/blog") },
                { "@type": "ListItem", position: 3, name: post.title, item: absolute(`/blog/${post.slug}`) },
              ],
            },
          ],
        }}
      />
      <main className="flex-1">
        <article className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground">
            <ArrowLeftIcon className="size-4" /> All articles
          </Link>
          <div className="mt-10 grid gap-14 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="max-w-2xl">
              <header>
                <div className="flex items-center gap-3 text-muted-foreground text-xs">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary">{post.tag}</span>
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                  <span>{readingMinutes(post)} min read</span>
                </div>
                <h1 className="mt-5 text-balance font-heading font-semibold text-4xl leading-[1.1] tracking-[-0.035em] sm:text-5xl">{post.title}</h1>
                <p className="mt-5 text-pretty text-muted-foreground text-xl leading-8">{post.description}</p>
              </header>
              <hr className="my-9" />
              <Prose blocks={post.blocks} />
            </div>
            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-8">
                <nav aria-label="Table of contents">
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">On this page</p>
                  <ul className="mt-4 space-y-2.5 border-s text-sm">
                    {toc.map((h) => (
                      <li key={h.id}>
                        <a href={`#${h.id}`} className="-ms-px block border-s border-transparent ps-4 text-muted-foreground leading-5 hover:border-primary hover:text-foreground">
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
                <div className="rounded-xl border bg-card p-5">
                  <p className="font-heading font-medium text-sm">Try it on a real call</p>
                  <p className="mt-1.5 text-muted-foreground text-sm leading-6">Build a voice agent in Hindi, Tamil, Telugu and more.</p>
                  <Button size="sm" className="mt-4" render={<Link href="/signup" />}>
                    Get started
                  </Button>
                </div>
              </div>
            </aside>
          </div>

          <section className="mt-20 border-t pt-12">
            <h2 className="font-heading font-semibold text-xl tracking-tight">Keep reading</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {related.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="group rounded-2xl border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-sm">
                  <span className="text-primary text-xs">{p.tag}</span>
                  <h3 className="mt-2 font-heading font-semibold text-lg tracking-tight">{p.title}</h3>
                  <span className="mt-4 inline-flex items-center gap-1.5 font-medium text-primary text-sm">
                    Read <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </article>
        <Cta />
      </main>
      <Footer />
    </>
  );
}
