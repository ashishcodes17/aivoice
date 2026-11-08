"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownLeftIcon, ArrowUpRightIcon, ChevronRightIcon, ClockIcon, PhoneCallIcon, SearchIcon, WalletIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OutcomeBadge } from "@/components/dashboard/outcome-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { duration, rupees } from "@/lib/format";
import { formatDid } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { Call } from "@/lib/types";

const statusVariant = { initiated: "outline", answered: "info", ended: "secondary", completed: "success", failed: "error" } as const;

const DIRECTIONS = [
  { value: "all", label: "All" },
  { value: "inbound", label: "Incoming" },
  { value: "outbound", label: "Outgoing" },
] as const;
const STATUSES = [
  { value: "all", label: "Any status" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
] as const;

const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function dayHeading(iso: string, now: number) {
  const d = new Date(iso);
  const key = keyFmt.format(d);
  if (key === keyFmt.format(new Date(now))) return "Today";
  if (key === keyFmt.format(new Date(now - 86400000))) return "Yesterday";
  return dayFmt.format(d);
}

const person = (c: Call) => {
  const n = (c.direction === "inbound" ? c.from_number : c.to_number) ?? "";
  return n ? formatDid(n.length === 10 ? `91${n}` : n) : "Unknown number";
};

export function CallsList({ calls }: { calls: Call[] }) {
  const [direction, setDirection] = useState<(typeof DIRECTIONS)[number]["value"]>("all");
  const [status, setStatus] = useState<(typeof STATUSES)[number]["value"]>("all");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.replace(/\D/g, "");
    const text = query.trim().toLowerCase();
    return calls.filter(
      (c) =>
        (direction === "all" || c.direction === direction) &&
        (status === "all" || c.status === status) &&
        (!text || (q && `${c.from_number}${c.to_number}`.includes(q)) || (c.agents?.name ?? "").toLowerCase().includes(text)),
    );
  }, [calls, direction, status, query]);

  const seconds = shown.reduce((s, c) => s + c.duration_seconds, 0);
  const cost = shown.reduce((s, c) => s + c.cost_paise, 0);

  const [now] = useState(() => Date.now());
  const groups = useMemo(() => {
    const out: { heading: string; calls: Call[] }[] = [];
    for (const c of shown) {
      const heading = dayHeading(c.created_at, now);
      const last = out[out.length - 1];
      if (last?.heading === heading) last.calls.push(c);
      else out.push({ heading, calls: [c] });
    }
    return out;
  }, [shown, now]);

  const stats = [
    { label: "Calls", value: String(shown.length), icon: PhoneCallIcon },
    { label: "Talk time", value: `${Math.round(seconds / 60)} min`, icon: ClockIcon },
    { label: "Spent", value: rupees(cost), icon: WalletIcon },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border bg-card px-4 py-3">
            <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Icon className="size-3.5" /> {label}
            </p>
            <p className="mt-1 truncate font-heading font-semibold text-lg tabular-nums tracking-tight sm:text-xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Direction" className="flex gap-1 rounded-full bg-muted p-1">
          {DIRECTIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              role="tab"
              aria-selected={direction === d.value}
              onClick={() => setDirection(d.value)}
              className={cn("cursor-pointer rounded-full px-3.5 py-1.5 text-sm transition-colors", direction === d.value ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div role="tablist" aria-label="Status" className="flex gap-1 rounded-full bg-muted p-1">
          {STATUSES.map((d) => (
            <button
              key={d.value}
              type="button"
              role="tab"
              aria-selected={status === d.value}
              onClick={() => setStatus(d.value)}
              className={cn("cursor-pointer rounded-full px-3.5 py-1.5 text-sm transition-colors", status === d.value ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {d.label}
            </button>
          ))}
        </div>
        <label className="relative min-w-48 flex-1 sm:ml-auto sm:max-w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search number or agent"
            aria-label="Search calls"
            className="h-9 w-full rounded-full border bg-background pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:ring-4 focus:ring-primary/15"
          />
        </label>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={SearchIcon} title="No calls match" description="Try a different filter or search." />
      ) : (
        groups.map((g) => (
          <section key={g.heading}>
            <h2 className="mb-2 px-1 font-medium text-muted-foreground text-sm">{g.heading}</h2>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {g.calls.map((c) => {
                const Icon = c.direction === "inbound" ? ArrowDownLeftIcon : ArrowUpRightIcon;
                const failed = c.status === "failed";
                const summary = c.metadata?.outcome?.summary;
                return (
                  <li key={c.id}>
                    <Link href={`/dashboard/calls/${c.id}`} className="group flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                      <div className="flex min-w-0 flex-1 items-center gap-3.5">
                        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", failed ? "bg-destructive/10 text-destructive-foreground" : c.direction === "inbound" ? "bg-success/10 text-success-foreground" : "bg-primary/10 text-primary")}>
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium tabular-nums">{person(c)}</p>
                          <p className="truncate text-muted-foreground text-xs">
                            {c.direction === "inbound" ? "Incoming" : "Outgoing"} · {c.agents?.name ?? "No agent"} · {timeFmt.format(new Date(c.created_at))}
                          </p>
                          {summary && <p className="mt-1 hidden truncate text-foreground/70 text-sm md:block">{summary}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-[3.375rem] sm:flex-nowrap sm:gap-x-4 sm:pl-0">
                        <span className="sm:flex sm:w-40 sm:justify-end">{c.metadata?.outcome && <OutcomeBadge outcome={c.metadata.outcome} />}</span>
                        <Badge variant={statusVariant[c.status]} className="capitalize">
                          {c.status}
                        </Badge>
                        <span className="text-sm tabular-nums sm:w-16 sm:text-right">{duration(c.duration_seconds)}</span>
                        <span className="text-muted-foreground text-sm tabular-nums sm:w-16 sm:text-right">{rupees(c.cost_paise)}</span>
                        <ChevronRightIcon className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      {calls.length >= 100 && <p className="text-center text-muted-foreground text-xs">Showing the latest 100 calls.</p>}
    </div>
  );
}
