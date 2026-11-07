import Link from "next/link";
import { cn } from "@/lib/utils";
import { RANGES, type Range } from "@/lib/usage";

export function RangeTabs({ current }: { current: Range }) {
  return (
    <nav aria-label="Date range" className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {RANGES.map((r) => (
        <Link
          key={r}
          href={`/dashboard/usage?range=${r}`}
          aria-current={r === current ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm transition-colors",
            r === current ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r} days
        </Link>
      ))}
    </nav>
  );
}
