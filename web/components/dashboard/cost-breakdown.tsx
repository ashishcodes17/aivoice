import { inr, rupees } from "@/lib/format";
import type { CostSummary } from "@/lib/types";

export function CostBreakdown({ cost, chargedPaise }: { cost: CostSummary; chargedPaise: number }) {
  const rows = [
    { part: "AI model", detail: `${cost.llm.prompt_tokens} tokens in, ${cost.llm.completion_tokens} out`, inr: cost.llm.inr },
    { part: "Voice", detail: `${cost.tts.characters} characters`, inr: cost.tts.inr },
    { part: "Hearing", detail: `${Math.round(cost.stt.seconds)} s of audio`, inr: cost.stt.inr },
  ];
  const charged = chargedPaise / 100;
  return (
    <section>
      <h2 className="font-heading font-semibold text-base tracking-tight">What this call cost</h2>
      <div className="mt-4 max-w-2xl overflow-hidden rounded-xl border">
        <dl className="divide-y">
          {rows.map((r) => (
            <div key={r.part} className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
              <dt>
                <span className="font-medium">{r.part}</span>
                <span className="ml-2 text-muted-foreground">{r.detail}</span>
              </dt>
              <dd className="tabular-nums">{r.inr == null ? "—" : inr(r.inr)}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between bg-muted/40 px-4 py-3 text-sm">
            <dt className="font-medium">AI cost{cost.complete ? "" : " (partial)"}</dt>
            <dd className="font-medium tabular-nums">{inr(cost.total_inr)}</dd>
          </div>
          <div className="flex items-baseline justify-between px-4 py-3 text-sm">
            <dt className="text-muted-foreground">Charged to the wallet</dt>
            <dd className="tabular-nums">{rupees(chargedPaise)}</dd>
          </div>
          <div className="flex items-baseline justify-between px-4 py-3 text-sm">
            <dt className="text-muted-foreground">Left after AI cost</dt>
            <dd className="tabular-nums">{inr(charged - cost.total_inr)}</dd>
          </div>
        </dl>
      </div>
      <p className="mt-2 max-w-2xl text-muted-foreground text-xs">
        Phone-line charges from VoiceLink are not included. The model cost is exact (reported by OpenRouter at ${cost.llm.usd.toFixed(6)},
        converted at ₹{cost.usd_to_inr}/USD); voice and hearing are measured units times published rates.
      </p>
    </section>
  );
}
