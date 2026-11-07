"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRightIcon, BotIcon, MoonIcon, PhoneMissedIcon, ShieldCheckIcon, TrendingDownIcon, UsersIcon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Accent, Section, SectionHeading } from "./section";

// An interactive "what is this costing you" calculator. Every figure is derived from the
// visitor's own inputs; the AI per-minute rate is an editable assumption, not a quoted price.

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const compact = (n: number) =>
  n >= 10_000_000 ? `₹${(n / 10_000_000).toFixed(1)} Cr`
  : n >= 100_000 ? `₹${(n / 100_000).toFixed(1)} L`
  : inr(n);

// Eases the displayed number toward its target so changes feel alive instead of jumping.
function useCountUp(target: number, ms = 600) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min((now - t0) / ms, 1);
      const v = start + (target - start) * (1 - (1 - k) ** 3);
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

const PRESETS = [
  { label: "Clinic", calls: 800, minutes: 3, hourly: 180 },
  { label: "Real estate", calls: 1200, minutes: 4, hourly: 250 },
  { label: "Support desk", calls: 5000, minutes: 5, hourly: 220 },
  { label: "Sales team", calls: 2500, minutes: 6, hourly: 300 },
];

function RangeField({
  num,
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  format,
  ends,
}: {
  num: number;
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  ends: [string, string];
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="flex items-center gap-2.5 font-medium text-sm">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] text-primary">{num}</span>
          {label}
        </label>
        <output htmlFor={id} className="rounded-md bg-primary/10 px-2.5 py-1 font-mono font-semibold text-primary text-sm tabular-nums">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--pct" as string]: `${pct}%` }}
        className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-[linear-gradient(to_right,var(--primary)_var(--pct),var(--muted)_var(--pct))] outline-none transition-shadow focus-visible:ring-4 focus-visible:ring-primary/20 [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-transform active:[&::-webkit-slider-thumb]:scale-110"
      />
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{ends[0]}</span>
        {hint && <span>{hint}</span>}
        <span>{ends[1]}</span>
      </div>
    </div>
  );
}

function Calculator() {
  const [calls, setCalls] = useState(1500);
  const [minutes, setMinutes] = useState(3);
  const [hourly, setHourly] = useState(200);
  const [rate, setRate] = useState(8);
  const [preset, setPreset] = useState<string | null>(null);

  const totalMin = calls * minutes;
  const human = (totalMin / 60) * hourly;
  const ai = totalMin * rate;
  const saved = Math.max(human - ai, 0);
  const pct = human > 0 ? Math.round((saved / human) * 100) : 0;
  const hours = Math.round(totalMin / 60);
  const aiBar = human > 0 ? Math.min((ai / human) * 100, 100) : 0;
  const cheaper = ai < human;
  const shownSaved = useCountUp(saved);

  const apply = (p: (typeof PRESETS)[number]) => {
    setCalls(p.calls);
    setMinutes(p.minutes);
    setHourly(p.hourly);
    setPreset(p.label);
  };

  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-x-6 -inset-y-8 -z-10 bg-[radial-gradient(50%_60%_at_75%_40%,color-mix(in_srgb,var(--primary)_14%,transparent),transparent)]" />
      <div className="overflow-hidden rounded-3xl border bg-card shadow-black/[0.06] shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-5 py-3.5 sm:px-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">Start from</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => apply(p)}
                aria-pressed={preset === p.label}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  preset === p.label ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/40 hover:text-primary",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <i className="size-1.5 animate-pulse rounded-full bg-success" /> Updates live
          </span>
        </div>

        <div className="grid md:grid-cols-[1.05fr_1fr]">
          <div className="space-y-7 p-5 sm:p-8">
            <RangeField num={1} label="Calls per month" value={calls} onChange={(v) => { setCalls(v); setPreset(null); }} min={100} max={20000} step={100} format={(v) => v.toLocaleString("en-IN")} ends={["100", "20,000"]} />
            <RangeField num={2} label="Average call length" value={minutes} onChange={(v) => { setMinutes(v); setPreset(null); }} min={1} max={15} step={1} format={(v) => `${v} min`} ends={["1 min", "15 min"]} />
            <RangeField num={3} label="Human caller cost per hour" hint="salary + overheads" value={hourly} onChange={(v) => { setHourly(v); setPreset(null); }} min={80} max={800} step={10} format={inr} ends={["₹80", "₹800"]} />
            <label className="flex items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/30 p-3.5 text-sm">
              <span>
                <span className="flex items-center gap-2.5 font-medium">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] text-primary">4</span>
                  Agent rate per minute
                </span>
                <span className="mt-0.5 block pl-[30px] text-muted-foreground text-xs">An assumption. Edit to match your plan.</span>
              </span>
              <span className="flex items-center rounded-lg border bg-background px-2.5 py-1.5 focus-within:ring-4 focus-within:ring-primary/20">
                <span className="text-muted-foreground text-sm">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  max={100}
                  step={0.5}
                  value={rate}
                  onChange={(e) => setRate(Math.max(0, Number(e.target.value) || 0))}
                  className="w-14 bg-transparent text-right font-mono text-sm tabular-nums outline-none"
                />
              </span>
            </label>
          </div>

          <div className="relative flex flex-col justify-between overflow-hidden bg-[#1e1b4b] p-6 text-white sm:p-8">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(70%_50%_at_90%_0%,rgb(235_104_52/0.45),transparent),radial-gradient(60%_60%_at_0%_100%,rgb(99_102_241/0.5),transparent)]" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <p className="text-white/70 text-xs uppercase tracking-wider">{cheaper ? "You keep every month" : "Your numbers"}</p>
                {cheaper && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 font-medium text-emerald-300 text-xs">
                    <TrendingDownIcon className="size-3.5" /> {pct}% lower cost
                  </span>
                )}
              </div>
              <p aria-hidden className="mt-3 font-heading font-semibold text-6xl tabular-nums tracking-[-0.05em] sm:text-7xl">{compact(shownSaved)}</p>
              <p className="sr-only" aria-live="polite">Monthly saving {compact(saved)}</p>
              <p className="mt-2 text-sm text-white/75">
                {cheaper ? <>About <b className="font-semibold text-white">{compact(saved * 12)}</b> over a year.</> : "A human caller costs less at these inputs. Try a higher hourly cost or shorter calls."}
              </p>
            </div>

            <div className="relative mt-8 space-y-4">
              <div>
                <div className="mb-1.5 flex justify-between text-white/70 text-xs">
                  <span className="flex items-center gap-1.5"><UsersIcon className="size-3.5" />Human callers</span>
                  <span className="tabular-nums">{compact(human)}</span>
                </div>
                <div className="h-3 rounded-full bg-white/10"><div className="h-full w-full rounded-full bg-white/35" /></div>
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium"><BotIcon className="size-3.5" />Lynksy agent</span>
                  <span className="tabular-nums">{compact(ai)}</span>
                </div>
                <div className="h-3 rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-300 to-white transition-[width] duration-500 ease-out" style={{ width: `${aiBar}%` }} />
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-2 border-white/15 border-t pt-4 text-center">
                {[
                  { k: "Hours freed", v: hours.toLocaleString("en-IN") },
                  { k: "Per call, human", v: inr((minutes / 60) * hourly) },
                  { k: "Per call, agent", v: inr(minutes * rate) },
                ].map((x) => (
                  <div key={x.k} className="rounded-lg bg-white/5 px-1 py-2.5">
                    <dd className="font-heading font-semibold text-lg tabular-nums">{x.v}</dd>
                    <dt className="mt-0.5 text-[10px] text-white/60 uppercase tracking-wide">{x.k}</dt>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const REASONS = [
  {
    icon: PhoneMissedIcon,
    title: "Every missed call is a customer who rings your competitor",
    body: "People rarely leave a voicemail or call back. The agent picks up on the first ring, every time, so the lead is never lost to a busy line.",
  },
  {
    icon: MoonIcon,
    title: "Open at 2 a.m., on Diwali, during the rush",
    body: "No shifts, no sick days, no hiring and training cycle. Ten calls at once or a thousand, the callers wait for no one.",
  },
  {
    icon: ZapIcon,
    title: "Live in an afternoon, not a quarter",
    body: "Write what the agent should say, pick a voice and take a test call. Change the script any time and it applies to the next call.",
  },
];

export function Savings() {
  return (
    <Section id="savings" className="border-t bg-muted/30">
      <SectionHeading
        align="center"
        eyebrow="The maths"
        title={<>Your phone is either <Accent>earning</Accent> or costing you.</>}
        description="Move the sliders to your own call volume and see what answering every call with an agent would change. Nothing here is a guess about your business; it uses your numbers."
      />

      <div className="mt-14">
        <Calculator />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {REASONS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border bg-card p-5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4.5" />
            </span>
            <h3 className="mt-4 font-heading font-semibold text-base leading-snug tracking-tight">{title}</h3>
            <p className="mt-2 text-muted-foreground text-sm leading-6">{body}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center gap-4 text-center">
        <Button size="xl" render={<Link href="/signup" />}>
          Start saving on your first call
          <ArrowRightIcon />
        </Button>
        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <ShieldCheckIcon className="size-3.5 text-success-foreground" />
          Pay only for minutes used. Top up a small wallet, test it, and stop whenever you like.
        </p>
      </div>
    </Section>
  );
}
