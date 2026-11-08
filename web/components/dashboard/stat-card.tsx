import Link from "next/link";
import { ArrowDownRightIcon, ArrowUpRightIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Change against the period before, as a percentage. null when there is nothing to compare with. */
export type Trend = { percent: number | null; label: string; /** Spend going up is not good or bad, so it is drawn in grey. */ neutral?: boolean };

export function StatCard({ label, value, hint, href, icon: Icon, trend }: { label: string; value: string; hint?: string; href?: string; icon?: LucideIcon; trend?: Trend }) {
  const up = (trend?.percent ?? 0) >= 0;
  const body = (
    <div className="group h-full rounded-2xl border bg-card p-4 shadow-black/[0.03] shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-muted-foreground text-sm">{label}</p>
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-3 truncate font-heading font-semibold text-2xl tabular-nums tracking-[-0.03em] sm:text-3xl">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {trend && trend.percent != null && (
          <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium", trend.neutral ? "bg-muted text-muted-foreground" : up ? "bg-success/10 text-success-foreground" : "bg-destructive/10 text-destructive-foreground")}>
            {up ? <ArrowUpRightIcon className="size-3" /> : <ArrowDownRightIcon className="size-3" />}
            {Math.abs(trend.percent)}%
          </span>
        )}
        {trend?.percent != null && <span className="text-muted-foreground">{trend.label}</span>}
        {(!trend || trend.percent == null) && hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
