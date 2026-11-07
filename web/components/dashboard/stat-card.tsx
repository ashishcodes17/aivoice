import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, hint, href, icon: Icon }: { label: string; value: string; hint?: string; href?: string; icon?: LucideIcon }) {
  const body = (
    <div className="h-full rounded-xl border bg-card p-5 shadow-black/[0.03] shadow-xs transition-all hover:border-foreground/15 hover:shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">{label}</p>
        {Icon && (
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/8 text-primary">
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-3 font-heading font-semibold text-3xl tabular-nums tracking-[-0.03em]">{value}</p>
      {hint && <p className="mt-1 text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}
