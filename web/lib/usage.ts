// Usage numbers for the reports page: one row per day (Indian time), zero-filled, plus per-agent totals.

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

export function parseRange(value: string | string[] | undefined): Range {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 30;
}

const IST_MS = 5.5 * 60 * 60 * 1000;
const dayKey = (ms: number) => new Date(ms + IST_MS).toISOString().slice(0, 10);

/** The last `days` calendar days in IST, oldest first, as "YYYY-MM-DD". */
export function lastDays(days: number): string[] {
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => dayKey(now - (days - 1 - i) * 86_400_000));
}

/** ISO timestamp for the start of the oldest day in the range (IST midnight). */
export function rangeStart(days: number): string {
  const first = lastDays(days)[0];
  return new Date(Date.parse(first + "T00:00:00Z") - IST_MS).toISOString();
}

export type CallRow = {
  created_at: string;
  direction: "inbound" | "outbound";
  duration_seconds: number;
  cost_paise: number;
  agents: { name: string } | null;
};
export type MessageRow = { created_at: string; direction: "inbound" | "outbound" };

export type CallDay = { day: string; inbound: number; outbound: number; minutes: number; spend: number };
export type MessageDay = { day: string; customers: number; agent: number };
export type AgentUsage = { name: string; calls: number; minutes: number; spend: number };

export function summarize(days: string[], calls: CallRow[], messages: MessageRow[]) {
  const callDays = new Map<string, CallDay>(days.map((day) => [day, { day, inbound: 0, outbound: 0, minutes: 0, spend: 0 }]));
  const messageDays = new Map<string, MessageDay>(days.map((day) => [day, { day, customers: 0, agent: 0 }]));
  const agents = new Map<string, AgentUsage>();

  for (const c of calls) {
    const d = callDays.get(dayKey(Date.parse(c.created_at)));
    if (!d) continue;
    d[c.direction] += 1;
    d.minutes += c.duration_seconds / 60;
    d.spend += c.cost_paise / 100;
    const name = c.agents?.name ?? "Deleted agent";
    const a = agents.get(name) ?? { name, calls: 0, minutes: 0, spend: 0 };
    a.calls += 1;
    a.minutes += c.duration_seconds / 60;
    a.spend += c.cost_paise / 100;
    agents.set(name, a);
  }
  for (const m of messages) {
    const d = messageDays.get(dayKey(Date.parse(m.created_at)));
    if (d) d[m.direction === "inbound" ? "customers" : "agent"] += 1;
  }

  const callSeries = [...callDays.values()];
  const totalCalls = callSeries.reduce((s, d) => s + d.inbound + d.outbound, 0);
  const minutes = callSeries.reduce((s, d) => s + d.minutes, 0);
  const spend = callSeries.reduce((s, d) => s + d.spend, 0);
  return {
    callSeries,
    messageSeries: [...messageDays.values()],
    byAgent: [...agents.values()].sort((a, b) => b.minutes - a.minutes),
    totals: {
      calls: totalCalls,
      minutes,
      spend,
      avgSeconds: totalCalls ? (minutes * 60) / totalCalls : 0,
      messages: messages.length,
    },
  };
}
