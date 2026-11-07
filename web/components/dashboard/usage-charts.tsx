"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AgentUsage, CallDay, MessageDay } from "@/lib/usage";

const shortDate = (day: string) =>
  new Date(day + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const longDate = (day: string) =>
  new Date(day + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const money = (v: number) => "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });

// Thin marks, recessive grid, no vertical grid lines, axis text in the muted ink.
const AXIS = { tickLine: false, axisLine: false, tickMargin: 8, className: "text-xs" } as const;

function xAxis(count: number) {
  return <XAxis dataKey="day" {...AXIS} tickFormatter={shortDate} interval={Math.max(0, Math.ceil(count / 7) - 1)} />;
}

const callsConfig = {
  inbound: { label: "Inbound", color: "var(--viz-1)" },
  outbound: { label: "Outbound", color: "var(--viz-2)" },
} satisfies ChartConfig;

export function CallsChart({ data }: { data: CallDay[] }) {
  return (
    <ChartContainer config={callsConfig} className="h-60 w-full">
      <BarChart data={data} margin={{ left: -16, right: 4, top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        {xAxis(data.length)}
        <YAxis {...AXIS} allowDecimals={false} width={44} />
        <ChartTooltip cursor={{ fillOpacity: 0.06 }} content={<ChartTooltipContent labelFormatter={(_, p) => longDate(p[0].payload.day)} />} />
        <ChartLegend content={<ChartLegendContent />} />
        {/* A 2px gap in the surface colour separates the stacked segments. */}
        <Bar dataKey="inbound" stackId="c" fill="var(--color-inbound)" stroke="var(--card)" strokeWidth={2} radius={[0, 0, 4, 4]} maxBarSize={28} />
        <Bar dataKey="outbound" stackId="c" fill="var(--color-outbound)" stroke="var(--card)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  );
}

const spendConfig = { spend: { label: "Spend", color: "var(--viz-1)" } } satisfies ChartConfig;

export function SpendChart({ data }: { data: CallDay[] }) {
  return (
    <ChartContainer config={spendConfig} className="h-60 w-full">
      <AreaChart data={data} margin={{ left: -8, right: 8, top: 8 }} accessibilityLayer>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-spend)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-spend)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        {xAxis(data.length)}
        <YAxis {...AXIS} width={52} tickFormatter={(v) => "₹" + v} />
        <ChartTooltip
          cursor={{ strokeOpacity: 0.3 }}
          content={<ChartTooltipContent indicator="line" labelFormatter={(_, p) => longDate(p[0].payload.day)} formatter={(v) => <span className="font-medium tabular-nums">{money(Number(v))}</span>} />}
        />
        <Area dataKey="spend" type="monotone" stroke="var(--color-spend)" strokeWidth={2} fill="url(#spendFill)" dot={false} activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} />
      </AreaChart>
    </ChartContainer>
  );
}

const messagesConfig = {
  customers: { label: "Customer messages", color: "var(--viz-1)" },
  agent: { label: "Agent replies", color: "var(--viz-2)" },
} satisfies ChartConfig;

export function MessagesChart({ data }: { data: MessageDay[] }) {
  return (
    <ChartContainer config={messagesConfig} className="h-60 w-full">
      <BarChart data={data} margin={{ left: -16, right: 4, top: 8 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        {xAxis(data.length)}
        <YAxis {...AXIS} allowDecimals={false} width={44} />
        <ChartTooltip cursor={{ fillOpacity: 0.06 }} content={<ChartTooltipContent labelFormatter={(_, p) => longDate(p[0].payload.day)} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="customers" stackId="m" fill="var(--color-customers)" stroke="var(--card)" strokeWidth={2} radius={[0, 0, 4, 4]} maxBarSize={28} />
        <Bar dataKey="agent" stackId="m" fill="var(--color-agent)" stroke="var(--card)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  );
}

const agentConfig = { minutes: { label: "Talk time (min)", color: "var(--viz-1)" } } satisfies ChartConfig;

export function AgentChart({ data }: { data: AgentUsage[] }) {
  const rows = data.slice(0, 6).map((a) => ({ ...a, minutes: Math.round(a.minutes * 10) / 10 }));
  return (
    <ChartContainer config={agentConfig} className="w-full" style={{ height: 56 + rows.length * 40 }}>
      <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 40 }} accessibilityLayer>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" {...AXIS} width={110} />
        <ChartTooltip cursor={{ fillOpacity: 0.06 }} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[0, 4, 4, 0]} maxBarSize={22}>
          <LabelList dataKey="minutes" position="right" className="fill-foreground text-xs tabular-nums" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
