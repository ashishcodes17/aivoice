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
  config: { tts_model?: string; tts_pace?: number } | null;
  created_at: string;
};

export type PhoneNumber = {
  id: string;
  did_number: string;
  agent_id: string | null;
  created_at: string;
  agents: { name: string } | null;
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
};

export type LedgerEntry = {
  id: number;
  kind: "topup" | "call_debit" | "refund" | "adjustment";
  amount_paise: number;
  note: string | null;
  created_at: string;
};
