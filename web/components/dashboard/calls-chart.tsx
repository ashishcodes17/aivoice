// Calls per day as plain bars with a grid and hover labels. Server-rendered; no chart library for 14 numbers.
export type DayCount = { label: string; day: string; count: number; weekday: string; today?: boolean };

const niceMax = (n: number) => (n <= 4 ? 4 : Math.ceil(n / 4) * 4);

export function CallsChart({ days }: { days: DayCount[] }) {
  const top = niceMax(Math.max(1, ...days.map((d) => d.count)));
  const total = days.reduce((s, d) => s + d.count, 0);
  const ticks = [top, (top * 3) / 4, top / 2, top / 4, 0];
  return (
    <figure>
      <figcaption className="sr-only">{`${total} calls in the last ${days.length} days`}</figcaption>
      <div className="flex gap-3" role="img" aria-label={`Calls per day, ${total} in the last ${days.length} days`}>
        <div aria-hidden className="flex h-40 flex-col justify-between text-right text-muted-foreground text-[11px] tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="leading-none">{Number.isInteger(t) ? t : ""}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div aria-hidden className="absolute inset-0 flex h-40 flex-col justify-between">
            {ticks.map((t) => (
              <div key={t} className="border-t border-dashed border-border/70" />
            ))}
          </div>
          <div className="relative flex h-40 items-end gap-1.5 sm:gap-2.5">
            {days.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
                <div
                  className={d.count ? (d.today ? "rounded-t-md bg-primary" : "rounded-t-md bg-primary/55 transition-colors group-hover:bg-primary") : "rounded-t-sm bg-muted"}
                  style={{ height: d.count ? `${Math.max(5, (d.count / top) * 100)}%` : "3px" }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] text-background opacity-0 shadow transition-opacity group-hover:opacity-100">
                  {d.label}: {d.count} {d.count === 1 ? "call" : "calls"}
                </span>
              </div>
            ))}
          </div>
          <div aria-hidden className="mt-2 flex gap-1.5 text-center text-[11px] text-muted-foreground sm:gap-2.5">
            {days.map((d) => (
              <span key={d.day} className={d.today ? "flex-1 font-medium text-foreground" : "flex-1"}>{d.weekday}</span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
