export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-heading font-semibold text-2xl tracking-[-0.03em]">{title}</h1>
        {description && <p className="mt-1.5 text-muted-foreground text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-8">{children}</div>;
}

export function PageFallback() {
  return (
    <div className="space-y-3" aria-busy>
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
    </div>
  );
}
