import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoMark } from "./logo";

const links = [
  { href: "/#product", label: "Product" },
  { href: "/#languages", label: "Languages" },
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark className="size-7" />
          <span className="font-heading font-semibold text-[15px] tracking-tight">Lynksy</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-muted-foreground text-sm transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button render={<Link href="/signup" />}>Get started</Button>
        </div>
      </div>
    </header>
  );
}
