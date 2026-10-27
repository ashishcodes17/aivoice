"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseIndianMobile } from "@/lib/phone";
import { placeCall } from "@/lib/voicelink";
import { CALL_LANGUAGES, CALL_PROVIDERS, isSupported } from "@/lib/call-voices";
import { findVoice, languageLabel, providerLabel, voiceConfig } from "@/lib/voices";
import { LANGUAGES, SARVAM_TTS_MODELS, STT_PROVIDERS, TTS_PROVIDERS } from "@/lib/languages";

export type ActionState = { error?: string; message?: string };

export async function createOrganization(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", { p_name: name });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard", "layout");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const AgentSchema = z.object({
  name: z.string().trim().min(1, "Give the agent a name.").max(80),
  language: z.enum(LANGUAGES.map((l) => l.value) as [string, ...string[]]),
  first_message: z.string().trim().max(500),
  system_prompt: z.string().trim().min(1, "Write a prompt describing how the agent should behave.").max(8000),
  llm_model: z.string().trim().min(1, "Enter a model, for example openai/gpt-4o-mini.").max(120),
  stt_provider: z.enum(STT_PROVIDERS.map((p) => p.value) as [string, ...string[]]),
  tts_provider: z.enum(TTS_PROVIDERS.map((p) => p.value) as [string, ...string[]]),
  tts_voice: z.string().trim().max(120),
  tts_model: z.enum(SARVAM_TTS_MODELS.map((m) => m.value) as [string, ...string[]]),
  outbound_first_message: z.string().trim().max(500),
  tts_pace: z.coerce.number().min(0.5, "Speed must be between 0.5 and 2.").max(2, "Speed must be between 0.5 and 2."),
});

export async function saveAgent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = AgentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, org } = await requireOrg();
  const id = String(formData.get("id") ?? "");
  const { tts_model, tts_pace, outbound_first_message, ...fields } = parsed.data;
  const row = {
    ...fields,
    tts_voice: fields.tts_voice || null,
    config: { tts_model, tts_pace, ...(outbound_first_message ? { outbound_first_message } : {}) },
  };

  // RLS also enforces org membership; org_id comes from the session, never the form.
  const { error } = id
    ? await supabase.from("agents").update(row).eq("id", id).eq("org_id", org.id)
    : await supabase.from("agents").insert({ ...row, org_id: org.id });
  if (error) return { error: error.message };

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/agents");
}

export async function deleteAgent(id: string) {
  const { supabase, org } = await requireOrg();
  await supabase.from("agents").delete().eq("id", id).eq("org_id", org.id);
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/agents");
}

const NumberSchema = z.object({
  did_number: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().min(10, "Enter the full phone number, including country code.").max(15)),
  agent_id: z.string().uuid("Choose an agent for this number."),
});

export async function addNumber(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = NumberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, org } = await requireOrg();
  const { error } = await supabase.from("phone_numbers").insert({ ...parsed.data, org_id: org.id });
  if (error) {
    return { error: error.code === "23505" ? "That number is already connected to an agent." : error.message };
  }
  revalidatePath("/dashboard", "layout");
  return {};
}

export async function removeNumber(id: string) {
  const { supabase, org } = await requireOrg();
  await supabase.from("phone_numbers").delete().eq("id", id).eq("org_id", org.id);
  revalidatePath("/dashboard", "layout");
}

// ---- Request a call: the agent dials a number the user enters --------------------------------

// Generous enough to test an agent repeatedly; the wallet is the real spending cap.
const MAX_CALLBACKS_PER_HOUR = 30; // per organization
const MAX_CALLBACKS_PER_NUMBER_PER_HOUR = 15;
const CALLBACK_COOLDOWN_MS = 45_000; // stops a double click ringing the same phone twice

const CallbackSchema = z.object({
  phone_number_id: z.string().uuid("Choose which number the agent should call from."),
  to: z.string().min(1, "Enter the number to call."),
  consent: z.string().refine((v) => v === "on", "Please confirm you have permission to call this number."),
  // "agent" = use whatever the agent itself is set to.
  tts_provider: z.enum(["agent", ...CALL_PROVIDERS.map((p) => p.value)] as [string, ...string[]]).default("agent"),
  language: z.enum(["agent", ...CALL_LANGUAGES.map((l) => l.value)] as [string, ...string[]]).default("agent"),
});

export async function requestCallback(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = CallbackSchema.safeParse({
    phone_number_id: formData.get("phone_number_id"),
    to: formData.get("to") ?? "",
    consent: formData.get("consent") ?? "",
    tts_provider: formData.get("tts_provider") ?? "agent",
    language: formData.get("language") ?? "agent",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { tts_provider, language } = parsed.data;
  // Only a provider chosen together with a language it speaks, or either one alone.
  if (tts_provider !== "agent" && language !== "agent" && !isSupported(tts_provider, language)) {
    return { error: "That voice provider does not speak that language. Pick another combination." };
  }
  const voice = tts_provider === "agent" && language === "agent" ? undefined : { tts_provider, language };
  const dest = parseIndianMobile(parsed.data.to);
  if ("error" in dest) return { error: dest.error };

  const { supabase, org, user } = await requireOrg();
  const { data: number } = await supabase
    .from("phone_numbers")
    .select("id, did_number, agent_id, agents(name)")
    .eq("id", parsed.data.phone_number_id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!number?.agent_id) return { error: "That number has no agent connected to it." };

  // Callbacks spend money. Off by default while billing is being set up; set
  // ENFORCE_WALLET_CHECK=true to require at least one minute of balance first.
  if (process.env.ENFORCE_WALLET_CHECK === "true") {
    const minutePaise = Number(process.env.CALL_RATE_PAISE_PER_MIN ?? 300);
    const { data: bal } = await supabase.from("wallet_balances").select("balance_paise").eq("org_id", org.id).maybeSingle();
    if (Number(bal?.balance_paise ?? 0) < minutePaise) {
      return { error: "Your wallet balance is too low to place a call. Add funds in Wallet first." };
    }
  }

  // Rate limits (callbacks are recorded as calls tagged metadata.kind = callback).
  const admin = createAdminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await admin
    .from("calls")
    .select("to_number, created_at")
    .eq("org_id", org.id)
    .eq("metadata->>kind", "callback")
    .neq("status", "failed") // a request VoiceLink refused never dialled, so it should not use up the allowance
    .gte("created_at", since);
  const rows = recent.data ?? [];
  if (rows.length >= MAX_CALLBACKS_PER_HOUR) {
    return { error: `You can request up to ${MAX_CALLBACKS_PER_HOUR} calls per hour. Please try again later.` };
  }
  const toThisNumber = rows.filter((r) => r.to_number === dest.national);
  if (toThisNumber.some((r) => Date.now() - new Date(r.created_at).getTime() < CALLBACK_COOLDOWN_MS)) {
    return { error: "That number was just called. Please wait a moment before requesting another call." };
  }
  if (toThisNumber.length >= MAX_CALLBACKS_PER_NUMBER_PER_HOUR) {
    return { error: "That number was called too many times this hour. Please try again later." };
  }

  // Record the call first; its id travels with the call so the worker can attach to this row.
  const { data: call, error: insertError } = await admin
    .from("calls")
    .insert({
      org_id: org.id,
      agent_id: number.agent_id,
      direction: "outbound",
      status: "initiated",
      from_number: number.did_number,
      to_number: dest.national,
      // The worker reads the voice choice from here, not from the call's parameters, so it is
      // something this server decided and checked.
      metadata: { kind: "callback", requested_by: user.id, ...(voice ? { voice } : {}) },
    })
    .select("id")
    .single();
  if (insertError || !call) return { error: "Could not start the call. Please try again." };

  const result = await placeCall({
    did: number.did_number,
    customerNumber: dest.national,
    params: { call_row_id: call.id, org_id: org.id, agent_id: number.agent_id, kind: "callback" },
  });
  if (!result.ok) {
    await admin.from("calls").update({ status: "failed", metadata: { kind: "callback", requested_by: user.id, ...(voice ? { voice } : {}), error: result.error } }).eq("id", call.id);
    revalidatePath("/dashboard", "layout");
    return { error: result.error };
  }
  await admin.from("calls").update({ metadata: { kind: "callback", requested_by: user.id, ...(voice ? { voice } : {}), queue_id: result.queueId ?? null } }).eq("id", call.id);
  revalidatePath("/dashboard", "layout");
  const how = voice
    ? ` (${[language !== "agent" && CALL_LANGUAGES.find((l) => l.value === language)?.label, tts_provider !== "agent" && CALL_PROVIDERS.find((p) => p.value === tts_provider)?.label].filter(Boolean).join(", ")})`
    : "";
  return { message: `Calling +91 ${dest.national} now${how}. Your phone should ring within a few seconds.` };
}

// ---- Voices: pick a voice from the gallery for one of your agents -------------------------------

const VoiceSchema = z.object({
  agent_id: z.string().uuid("Choose an agent."),
  provider: z.string().min(1),
  voice: z.string().min(1),
  language: z.string().min(1),
});

export async function setAgentVoice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = VoiceSchema.safeParse({
    agent_id: formData.get("agent_id"),
    provider: formData.get("provider"),
    voice: formData.get("voice"),
    language: formData.get("language"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { agent_id, provider, voice, language } = parsed.data;

  const choice = findVoice(provider, voice, language);
  if (!choice) return { error: "That voice is not available for this language." };

  const { supabase, org } = await requireOrg();
  const { data: agent } = await supabase.from("agents").select("id, name, language, config").eq("id", agent_id).eq("org_id", org.id).maybeSingle();
  if (!agent) return { error: "That agent was not found." };
  // A voice only suits the language the agent's prompt and speech recognition are set up for.
  if (agent.language !== language) {
    return { error: `${agent.name} speaks ${languageLabel(agent.language)}, so it needs a ${languageLabel(agent.language)} voice.` };
  }

  // Replace the old voice's settings (model, speed, style) with the new voice's, keep everything else.
  const rest = Object.fromEntries(
    Object.entries((agent.config ?? {}) as Record<string, unknown>).filter(([k]) => !["tts_model", "tts_pace", "tts_description"].includes(k)),
  );
  const { error } = await supabase
    .from("agents")
    .update({ tts_provider: provider, tts_voice: voice, config: { ...rest, ...voiceConfig(choice, language) } })
    .eq("id", agent_id)
    .eq("org_id", org.id);
  if (error) return { error: "Could not save the voice. Please try again." };
  revalidatePath("/dashboard", "layout");
  return { message: `${agent.name} now speaks with ${choice.label} (${providerLabel(provider)}). It applies to the next call.` };
}
