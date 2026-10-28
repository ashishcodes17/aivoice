export type Agent = {
  id: string;
  name: string;
  system_prompt: string;
  first_message: string;
  language: string;
  llm_model: string;
  stt_provider: string;
  tts_provider: string;
  tts_voice: string | null;
  config: { tts_model?: string; tts_pace?: number; outbound_first_message?: string } | null;
  created_at: string;
};

export type PhoneNumber = {
  id: string;
  did_number: string;
  agent_id: string | null;
  created_at: string;
  agents: { name: string } | null;
};

export type CostSummary = {
  usd_to_inr: number;
  llm: { model: string; requests: number; prompt_tokens: number; completion_tokens: number; usd: number; inr: number };
  tts: { provider: string; model: string | null; characters: number; rate_inr_per_1k_chars: number | null; inr: number | null };
  stt: { provider: string; seconds: number; rate_inr_per_min: number | null; inr: number | null };
  total_inr: number;
  complete: boolean;
};

export type CallOutcome = {
  outcome:
    | "visit_requested"
    | "callback_requested"
    | "busy_call_later"
    | "info_only"
    | "not_interested"
    | "no_conversation"
    | "qualified_lead"
    | "quote_requested"
    | "wrong_number"
    | "do_not_call";
  name: string | null;
  need: string | null;
  preferred_time: string | null;
  phone: string | null;
  details?: Record<string, string>;
  summary: string;
  follow_up: boolean;
};

export type Call = {
  id: string;
  direction: "inbound" | "outbound";
  status: "initiated" | "answered" | "ended" | "completed" | "failed";
  from_number: string | null;
  to_number: string | null;
  duration_seconds: number;
  cost_paise: number;
  created_at: string;
  agents: { name: string } | null;
  metadata?: { cost?: CostSummary; outcome?: CallOutcome } | null;
};

export type LedgerEntry = {
  id: number;
  kind: "topup" | "call_debit" | "refund" | "adjustment";
  amount_paise: number;
  note: string | null;
  created_at: string;
};
