import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoMark } from "./logo";
import { SolutionsMenu } from "./solutions-menu";

const links = [
  { href: "/#product", label: "Product" },
  { href: "/#languages", label: "Languages" },
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
];

/** Floating glass pill. Sits over the dark hero on the home page and over plain pages elsewhere. */
export function Header() {
  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full border border-black/[0.06] bg-white/75 py-2 pr-2 pl-5 shadow-[0_8px_30px_-12px_rgb(15_12_40/0.25)] backdrop-blur-xl backdrop-saturate-150">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark className="size-7" />
          <span className="font-heading font-semibold text-[15px] text-[#16162a] tracking-tight">Lynksy</span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          <SolutionsMenu />
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-[#55556d] text-sm transition-colors hover:text-[#16162a]">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" className="rounded-full text-[#16162a]" render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button className="rounded-full border-transparent bg-[#16162a] text-white shadow-none hover:bg-[#16162a]/90" render={<Link href="/signup" />}>
            Get started
          </Button>
        </div>
      </div>
    </header>
  );
}
