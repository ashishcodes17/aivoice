import Link from "next/link";

export function StatCard({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <div className="h-full rounded-xl border bg-card p-5 shadow-black/[0.03] shadow-xs transition-colors hover:bg-accent/30">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-2 font-heading font-semibold text-3xl tabular-nums tracking-[-0.03em]">{value}</p>
      {hint && <p className="mt-1 text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
