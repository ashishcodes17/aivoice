"use client";

import { useState } from "react";
import { ArrowDownLeftIcon, ArrowUpRightIcon, PhoneCallIcon, RotateCcwIcon, GiftIcon, HashIcon, SlidersHorizontalIcon, WalletIcon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { formatDateTime, rupees } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LedgerEntry } from "@/lib/types";

const KIND = {
  topup: { label: "Top-up", icon: ArrowDownLeftIcon, tone: "bg-success/10 text-success-foreground" },
  call_debit: { label: "Call usage", icon: PhoneCallIcon, tone: "bg-muted text-muted-foreground" },
  refund: { label: "Refund", icon: RotateCcwIcon, tone: "bg-info/10 text-info-foreground" },
  adjustment: { label: "Adjustment", icon: SlidersHorizontalIcon, tone: "bg-warning/15 text-warning-foreground" },
  number_rental: { label: "Number rent", icon: HashIcon, tone: "bg-muted text-muted-foreground" },
} as const;

const FILTERS = [
  { value: "all", label: "All" },
  { value: "in", label: "Money in" },
  { value: "out", label: "Usage" },
] as const;

export function LedgerList({ entries }: { entries: LedgerEntry[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const shown = entries.filter((e) => filter === "all" || (filter === "in" ? e.amount_paise > 0 : e.amount_paise < 0));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading font-semibold text-base tracking-tight">Transactions</h2>
        <div role="tablist" aria-label="Filter transactions" className="flex gap-1 rounded-full bg-muted p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn("cursor-pointer rounded-full px-3.5 py-1.5 text-sm transition-colors", filter === f.value ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {shown.length ? (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {shown.map((e) => {
            // The free credit is stored as an adjustment with a fixed note; show it for what it is.
            const gift = e.kind === "adjustment" && e.note === "Free test credit";
            const k = gift ? { label: "Free test credit", icon: GiftIcon, tone: "bg-success/10 text-success-foreground" } : KIND[e.kind];
            const Icon = e.amount_paise > 0 || e.kind === "call_debit" || e.kind === "number_rental" ? k.icon : ArrowUpRightIcon;
            return (
              <li key={e.id} className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", k.tone)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{k.label}</p>
                  <p className="truncate text-muted-foreground text-xs">
                    {formatDateTime(e.created_at)}
                    {e.note && !gift ? ` · ${e.note}` : ""}
                  </p>
                </div>
                <p className={cn("shrink-0 font-medium tabular-nums", e.amount_paise > 0 ? "text-success-foreground" : "text-foreground")}>
                  {e.amount_paise > 0 ? "+" : "−"}
                  {rupees(Math.abs(e.amount_paise))}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={WalletIcon} title="No transactions" description={entries.length ? "Nothing matches this filter." : "Top-ups and per-minute call charges will appear here."} />
      )}
      {entries.length >= 50 && <p className="text-center text-muted-foreground text-xs">Showing the latest 50 transactions.</p>}
    </section>
  );
}
