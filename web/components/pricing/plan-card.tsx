import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RATE_INR_PER_MINUTE } from "@/lib/pricing";

const included = [
  "Voice agents in Hindi, Telugu, Tamil and more",
  "Inbound and outbound calls",
  "Your choice of AI model and voice",
  "A full transcript of every call",
  "Cost shown on every call",
  "Top up with UPI or cards",
];

export function PlanCard() {
  return (
    <div className="flex flex-col rounded-2xl border bg-card p-8 shadow-black/[0.05] shadow-xl sm:p-10">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-semibold text-lg tracking-tight">Pay as you go</h2>
        <Badge variant="outline">Prepaid wallet</Badge>
      </div>

      <div className="mt-8 flex items-baseline gap-2">
        <span className="font-heading font-semibold text-7xl tabular-nums tracking-[-0.05em]">₹{RATE_INR_PER_MINUTE}</span>
        <span className="text-lg text-muted-foreground">per minute</span>
      </div>
      <p className="mt-3 text-muted-foreground text-sm leading-6">
        Billed per started minute, in rupees. You only pay for time your agent is on a call.
      </p>

      <Button size="xl" className="mt-8 w-full" render={<Link href="/signup" />}>
        Start building
        <ArrowRightIcon />
      </Button>

      <div className="my-8 h-px bg-border" />

      <ul className="space-y-3.5">
        {included.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success-foreground">
              <CheckIcon className="size-3" strokeWidth={2.75} />
            </span>
            <span className="leading-5">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
