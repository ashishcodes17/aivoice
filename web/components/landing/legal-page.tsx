import { Footer } from "./footer";
import { Header } from "./header";
import { SITE } from "@/lib/site";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">Legal</p>
          <h1 className="mt-4 font-heading font-semibold text-4xl tracking-[-0.035em] sm:text-5xl">{title}</h1>
          <p className="mt-3 text-muted-foreground text-sm">Last updated {SITE.legalUpdated}</p>
          <div className="mt-12 grid gap-14 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <nav aria-label="Contents" className="hidden lg:block">
              <ul className="sticky top-24 space-y-2.5 text-sm">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-muted-foreground leading-5 hover:text-foreground">
                      {i + 1}. {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="max-w-2xl">
              <p className="text-lg text-muted-foreground leading-8">{intro}</p>
              <div className="mt-10 space-y-10">
                {sections.map((s, i) => (
                  <section key={s.id} id={s.id} className="scroll-mt-24">
                    <h2 className="font-heading font-semibold text-xl tracking-tight">
                      {i + 1}. {s.title}
                    </h2>
                    <div className="mt-4 space-y-4 text-[15px] text-foreground/85 leading-7 [&_a]:text-primary [&_a]:underline [&_li]:ms-5 [&_li]:list-disc [&_ul]:space-y-1.5">
                      {s.body}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
