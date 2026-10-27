"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { RATE_INR_PER_MINUTE, inrWhole, number } from "@/lib/pricing";

const one = (v: number | readonly number[]) => (Array.isArray(v) ? v[0] : (v as number));

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-sm">{label}</span>
        <span className="font-medium text-sm tabular-nums">{value}</span>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function Estimator() {
  const [calls, setCalls] = useState(1000);
  const [length, setLength] = useState(2.5);

  // Every call is rounded up to a whole minute, so a 2.5 minute call bills as 3.
  const billedMinutes = Math.ceil(length);
  const perCall = billedMinutes * RATE_INR_PER_MINUTE;
  const total = calls * perCall;

  const stats = [
    ["Per call", inrWhole(perCall)],
    ["Billed minutes", number(calls * billedMinutes)],
    ["Per day", inrWhole(Math.round(total / 30))],
  ];

  return (
    <div className="flex flex-col rounded-2xl border bg-muted/30 p-8 sm:p-10">
      <h2 className="font-heading font-semibold text-lg tracking-tight">Estimate your month</h2>
      <p className="mt-1 text-muted-foreground text-sm">Slide to match your call volume.</p>

      <div className="mt-8 space-y-8">
        <Row label="Calls per month" value={number(calls)}>
          <Slider min={100} max={10000} step={100} value={calls} onValueChange={(v) => setCalls(one(v))} getAriaLabel={() => "Calls per month"} />
        </Row>
        <Row label="Average call length" value={`${length} min`}>
          <Slider min={0.5} max={10} step={0.5} value={length} onValueChange={(v) => setLength(one(v))} getAriaLabel={() => "Average call length in minutes"} />
        </Row>
      </div>

      <div className="mt-auto pt-10">
        <div className="rounded-xl border bg-background p-6">
          <p className="text-muted-foreground text-sm">Estimated monthly cost</p>
          <p data-testid="monthly-total" className="mt-2 font-heading font-semibold text-5xl tabular-nums tracking-[-0.04em]">
            {inrWhole(total)}
          </p>
          <p className="mt-3 text-muted-foreground text-sm tabular-nums">
            {number(calls)} calls × {billedMinutes} billed {billedMinutes === 1 ? "minute" : "minutes"} × ₹{RATE_INR_PER_MINUTE}
          </p>
          <dl className="mt-5 grid grid-cols-3 gap-4 border-t pt-5">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground text-xs">{label}</dt>
                <dd className="mt-1 font-medium text-sm tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="mt-3 text-muted-foreground text-xs">
          A call of {length} minutes is billed as {billedMinutes}, because every call rounds up to the next full minute.
        </p>
      </div>
    </div>
  );
}
