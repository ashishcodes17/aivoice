"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRightIcon, BellRingIcon, HeadphonesIcon, LandmarkIcon, TargetIcon, type LucideIcon } from "lucide-react";
import { AGENT_TEMPLATES, TEMPLATE_CATEGORIES, type TemplateCategory } from "@/lib/agent-templates";
import { LANGUAGES } from "@/lib/languages";
import { cn } from "@/lib/utils";

const ICONS: Record<TemplateCategory, LucideIcon> = {
  Reminder: BellRingIcon,
  Collections: LandmarkIcon,
  "Lead qualification": TargetIcon,
  Support: HeadphonesIcon,
};

export function AgentTemplates() {
  const [cat, setCat] = useState<"All" | TemplateCategory>("All");
  const list = AGENT_TEMPLATES.filter((t) => cat === "All" || t.category === cat);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-semibold text-lg tracking-tight">Agent templates</h2>
          <p className="text-muted-foreground text-sm">Start from a ready-made agent, then edit anything before you save.</p>
        </div>
        <div role="tablist" aria-label="Template category" className="flex flex-wrap gap-1">
          {(["All", ...TEMPLATE_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              role="tab"
              type="button"
              aria-selected={cat === c}
              onClick={() => setCat(c)}
              className={cn(
                "cursor-pointer rounded-full px-3.5 py-1.5 text-sm transition-colors",
                cat === c ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => {
          const Icon = ICONS[t.category];
          const lang = LANGUAGES.find((l) => l.value === t.language)?.label ?? t.language;
          return (
            <Link
              key={t.id}
              href={`/dashboard/agents/new?template=${t.id}`}
              className="group flex flex-col rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <ArrowUpRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <h3 className="mt-4 font-heading font-semibold text-base tracking-tight">{t.name}</h3>
              <p className="mt-1.5 flex-1 text-muted-foreground text-sm leading-6">{t.summary}</p>
              <div className="mt-4 flex gap-1.5 text-[11px]">
                <span className="rounded-full border px-2 py-0.5 text-muted-foreground">{t.category}</span>
                <span className="rounded-full border px-2 py-0.5 text-muted-foreground">{lang}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
