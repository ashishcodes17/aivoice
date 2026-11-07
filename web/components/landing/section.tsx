import { cn } from "@/lib/utils";

export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-20 sm:py-28", className)}>
      <div className="mx-auto max-w-6xl px-6">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-balance font-heading font-semibold text-3xl tracking-[-0.03em] sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-pretty text-base text-muted-foreground leading-7">{description}</p>
      )}
    </div>
  );
}

/** Italic serif accent used inside headings. */
export function Accent({ children }: { children: React.ReactNode }) {
  return <span className="font-normal font-serif text-primary italic tracking-normal">{children}</span>;
}
