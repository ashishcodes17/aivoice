import { AudioLinesIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** "Powered by Gnani AI" mark used wherever the product speaks or listens. */
export function PoweredByGnani({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 font-medium text-muted-foreground text-xs",
        className,
      )}
    >
      <AudioLinesIcon className="size-3.5 text-primary" />
      {compact ? "Gnani AI" : <>Powered by <span className="text-foreground">Gnani AI</span></>}
    </span>
  );
}
