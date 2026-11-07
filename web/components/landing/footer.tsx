import { cacheLife } from "next/cache";
import Link from "next/link";
import { LogoMark } from "./logo";

async function Year() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

import { solutions } from "@/lib/solutions";

const columns = [
  {
    title: "Solutions",
    links: solutions.map((s) => ({ href: `/solutions/${s.slug}`, label: s.name })),
  },
  {
    title: "Product",
    links: [
      { href: "/#product", label: "Features" },
      { href: "/#languages", label: "Languages" },
      { href: "/#how", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/#faq", label: "FAQ" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/signup", label: "Get started" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <LogoMark className="size-7" />
              <span className="font-heading font-semibold text-[15px] tracking-tight">Lynksy</span>
            </div>
            <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
              AI voice agents that answer and make phone calls in your customers' language, any time
              of day.
            </p>
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="font-heading font-medium text-sm">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-muted-foreground text-sm transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">
            © <Year /> Lynksy. All rights reserved.
          </p>
          <p className="text-muted-foreground text-xs">Made for India's businesses.</p>
        </div>
      </div>
    </footer>
  );
}
