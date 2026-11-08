import Link from "next/link";
import { cn } from "@/lib/utils";
import { RANGES, type Range } from "@/lib/usage";

export function RangeTabs({ current }: { current: Range }) {
  return (
    <nav aria-label="Date range" className="inline-flex gap-1 rounded-full bg-muted p-1">
      {RANGES.map((r) => (
        <Link
          key={r}
          href={`/dashboard/usage?range=${r}`}
          aria-current={r === current ? "page" : undefined}
          className={cn("rounded-full px-3.5 py-1.5 text-sm transition-colors", r === current ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {r} days
        </Link>
      ))}
    </nav>
  );
}
