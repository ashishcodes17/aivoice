import { cacheLife } from "next/cache";
import Link from "next/link";
import { LogoMark } from "./logo";

async function Year() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-6" />
          <span className="font-heading font-semibold text-sm tracking-tight">Lynksy</span>
        </div>
        <nav className="flex gap-6 text-muted-foreground text-sm">
          <Link href="/login" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
          <Link href="/#product" className="transition-colors hover:text-foreground">
            Product
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link href="/#faq" className="transition-colors hover:text-foreground">
            FAQ
          </Link>
        </nav>
        <p className="text-muted-foreground text-xs">© <Year /> Lynksy. All rights reserved.</p>
      </div>
    </footer>
  );
}
