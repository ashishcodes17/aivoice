import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Step = { done: boolean; title: string; body: string; href: string; cta: string };

// A vertical checklist. Only the first unfinished step gets the main button, so the next action is obvious.
export function GetStarted({ steps }: { steps: Step[] }) {
  const done = steps.filter((s) => s.done).length;
  const current = steps.findIndex((s) => !s.done);
  return (
    <section>
      <div className="flex items-baseline gap-2">
        <h2 className="font-heading font-semibold text-lg tracking-tight">Get started</h2>
        <span className="text-muted-foreground text-sm">· {done} of {steps.length} done</span>
      </div>
      <div className="mt-2 h-1 w-full max-w-xs overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-5 rounded-2xl border bg-card p-5 sm:p-6">
        {steps.map((s, i) => {
          const active = i === current;
          return (
            <li key={s.title} className="relative flex gap-4 pb-7 last:pb-0">
              {i < steps.length - 1 && (
                <span aria-hidden className={cn("absolute top-8 bottom-1 left-[13px] w-px", s.done ? "bg-success/40" : "bg-border")} />
              )}
              <span
                className={cn(
                  "relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 bg-card text-xs",
                  s.done && "border-success bg-success text-white",
                  active && "border-primary border-dashed text-primary",
                  !s.done && !active && "text-muted-foreground",
                )}
              >
                {s.done ? <CheckIcon className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <div className="flex flex-1 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className={cn("font-medium text-sm sm:text-base", s.done && "text-muted-foreground line-through")}>{s.title}</h3>
                  <p className="mt-0.5 text-muted-foreground text-sm leading-6">{s.body}</p>
                </div>
                {active && (
                  <Button size="sm" render={<Link href={s.href} />}>
                    {s.cta}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
