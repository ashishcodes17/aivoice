import { Badge } from "@/components/ui/badge";
import type { CallOutcome } from "@/lib/types";

export const outcomeLabel: Record<CallOutcome["outcome"], { label: string; variant: "success" | "info" | "warning" | "secondary" | "outline" }> = {
  visit_requested: { label: "Agreed to next step", variant: "success" },
  callback_requested: { label: "Wants a call back", variant: "info" },
  busy_call_later: { label: "Call later", variant: "warning" },
  info_only: { label: "Questions only", variant: "secondary" },
  not_interested: { label: "Not interested", variant: "outline" },
  no_conversation: { label: "No conversation", variant: "outline" },
};

export function OutcomeBadge({ outcome }: { outcome?: CallOutcome | null }) {
  if (!outcome) return <span className="text-muted-foreground">—</span>;
  const o = outcomeLabel[outcome.outcome] ?? outcomeLabel.info_only;
  return <Badge variant={o.variant}>{o.label}</Badge>;
}

export function OutcomeCard({ outcome }: { outcome: CallOutcome }) {
  const o = outcomeLabel[outcome.outcome] ?? outcomeLabel.info_only;
  const rows = [
    ["Name", outcome.name],
    ["Needs", outcome.need],
    ["Preferred time", outcome.preferred_time],
    ["Other number", outcome.phone],
  ].filter(([, v]) => v);
  return (
    <section>
      <div className="flex items-center gap-3">
        <h2 className="font-heading font-semibold text-base tracking-tight">What came of it</h2>
        <Badge variant={o.variant}>{o.label}</Badge>
        {outcome.follow_up && <Badge variant="warning">Needs a follow-up</Badge>}
      </div>
      <div className="mt-4 max-w-2xl overflow-hidden rounded-xl border">
        <p className="px-4 py-3 text-sm leading-6">{outcome.summary}</p>
        {rows.length > 0 && (
          <dl className="divide-y border-t">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <p className="mt-2 max-w-2xl text-muted-foreground text-xs">Written automatically from the transcript after the call. Check it before acting on it.</p>
    </section>
  );
}
