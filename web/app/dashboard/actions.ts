"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseIndianMobile } from "@/lib/phone";
import { buyNumber, listAvailableNumbers, placeCall } from "@/lib/voicelink";
import { NUMBER_PRICE_PAISE, PURCHASES_PER_ORG_PER_DAY, maxProviderCostRupees, purchasesEnabled } from "@/lib/numbers";
import { TEST_DID, TEST_LIMITS, TEST_NUMBER_ID, isTestDid } from "@/lib/test-number";
import { CALL_LANGUAGES, CALL_PROVIDERS, isSupported } from "@/lib/call-voices";
import { findVoice, languageLabel, providerLabel, voiceConfig } from "@/lib/voices";
import { LANGUAGES, STT_PROVIDERS, TTS_PROVIDERS } from "@/lib/languages";

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
  outbound_first_message: z.string().trim().max(500),
  variables: z.string().max(10000).optional(),
  tts_pace: z.coerce.number().min(0.5, "Speed must be between 0.5 and 2.").max(2, "Speed must be between 0.5 and 2."),
});

// The builder sends variables as a JSON object of name to value; keep only well-formed names.
function parseVariables(raw?: string): Record<string, string> {
  try {
    const obj = JSON.parse(raw || "{}") as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([k, v]) => /^[A-Za-z_]\w*$/.test(k) && typeof v === "string")
        .map(([k, v]) => [k, (v as string).slice(0, 500)]),
    );
  } catch {
    return {};
  }
}

export async function saveAgent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = AgentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, org } = await requireOrg();
  const id = String(formData.get("id") ?? "");
  const { tts_pace, outbound_first_message, variables, ...fields } = parsed.data;
  const vars = parseVariables(variables);

  // The builder only asks for a voice. The provider, model and style follow from the voice chosen.
  const VOICE_KEYS = ["tts_model", "tts_pace", "tts_description", "tts_temperature"];
  let existing: Record<string, unknown> = {};
  if (id) {
    const { data } = await supabase.from("agents").select("config").eq("id", id).eq("org_id", org.id).maybeSingle();
    existing = (data?.config ?? {}) as Record<string, unknown>;
  }
  const kept = Object.fromEntries(Object.entries(existing).filter(([k]) => ![...VOICE_KEYS, "outbound_first_message", "variables"].includes(k)));
  const choice = findVoice(fields.tts_provider, fields.tts_voice, fields.language);
  const voiceCfg = choice
    ? voiceConfig(choice, fields.language)
    : Object.fromEntries(VOICE_KEYS.filter((k) => k in existing).map((k) => [k, existing[k]])); // an older custom voice: leave as it was
  const row = {
    ...fields,
    tts_voice: fields.tts_voice || null,
    config: {
      ...kept,
      tts_model: "bulbul:v3",
      ...voiceCfg,
      tts_pace,
      ...(outbound_first_message ? { outbound_first_message } : {}),
      ...(Object.keys(vars).length ? { variables: vars } : {}),
    },
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

  // The shared test line belongs to everyone, so no account may claim it.
  if (isTestDid(parsed.data.did_number)) return { error: "That is the shared test number, so it can't be connected to an agent." };

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
  // A rented number is paid for, so it is cancelled (see cancelRental), not simply deleted.
  const { data: row } = await supabase.from("phone_numbers").select("source").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (row?.source === "purchased") return;
  await supabase.from("phone_numbers").delete().eq("id", id).eq("org_id", org.id);
  revalidatePath("/dashboard", "layout");
}

// ---- Request a call: the agent dials a number the user enters --------------------------------

// Generous enough to test an agent repeatedly; the wallet is the real spending cap.
const MAX_CALLBACKS_PER_HOUR = 30; // per organization
const MAX_CALLBACKS_PER_NUMBER_PER_HOUR = 15;
const CALLBACK_COOLDOWN_MS = 45_000; // stops a double click ringing the same phone twice

const CallbackSchema = z.object({
  phone_number_id: z.union([z.literal(TEST_NUMBER_ID), z.string().uuid()], { message: "Choose which number the agent should call from." }),
  to: z.string().min(1, "Enter the number to call."),
  consent: z.string().refine((v) => v === "on", "Please confirm you have permission to call this number."),
  // "number" = the agent connected to that number; otherwise one of this organisation's agents.
  agent_id: z.union([z.literal("number"), z.string().uuid()]).default("number"),
  // "agent" = use whatever the agent itself is set to.
  tts_provider: z.enum(["agent", ...CALL_PROVIDERS.map((p) => p.value)] as [string, ...string[]]).default("agent"),
  language: z.enum(["agent", ...CALL_LANGUAGES.map((l) => l.value)] as [string, ...string[]]).default("agent"),
});

// Test calls: tight limits, because they ring real phones from one number shared by every account.
async function testCallLimit(admin: ReturnType<typeof createAdminClient>, orgId: string, to: string): Promise<string | null> {
  const day = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [mine, platform] = await Promise.all([
    admin.from("calls").select("to_number, created_at").eq("org_id", orgId).eq("metadata->>kind", "test").neq("status", "failed").gte("created_at", day),
    admin.from("calls").select("id", { count: "exact", head: true }).eq("metadata->>kind", "test").neq("status", "failed").gte("created_at", day),
  ]);
  if (mine.error || platform.error) return "Test calls are unavailable right now. Please try again shortly.";
  if ((platform.count ?? 0) >= TEST_LIMITS.platformPerDay) return "Test calls are very busy today. Please try again tomorrow, or connect your own number.";

  const rows = mine.data ?? [];
  const hourAgo = Date.now() - 60 * 60 * 1000;
  if (rows.length >= TEST_LIMITS.perOrgPerDay) return `You can place up to ${TEST_LIMITS.perOrgPerDay} test calls a day. Try again tomorrow.`;
  if (rows.filter((r) => new Date(r.created_at).getTime() > hourAgo).length >= TEST_LIMITS.perOrgPerHour) {
    return `You can place up to ${TEST_LIMITS.perOrgPerHour} test calls an hour. Please wait a little.`;
  }
  const toThis = rows.filter((r) => r.to_number === to);
  if (toThis.some((r) => Date.now() - new Date(r.created_at).getTime() < TEST_LIMITS.cooldownMs)) {
    return "That number was just called. Please wait a minute before testing again.";
  }
  if (toThis.length >= TEST_LIMITS.perDestinationPerDay) return "That number has had enough test calls today. Try again tomorrow.";
  const phones = new Set(rows.map((r) => r.to_number));
  if (!phones.has(to) && phones.size >= TEST_LIMITS.destinationsPerOrgPerDay) {
    return `Test calls can go to at most ${TEST_LIMITS.destinationsPerOrgPerDay} different phones a day. Use your own number to call more.`;
  }
  return null;
}

export async function requestCallback(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = CallbackSchema.safeParse({
    phone_number_id: formData.get("phone_number_id"),
    to: formData.get("to") ?? "",
    consent: formData.get("consent") ?? "",
    agent_id: formData.get("agent_id") ?? "number",
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
  const isTest = parsed.data.phone_number_id === TEST_NUMBER_ID;
  let fromDid: string;
  let agentId: string | null;
  if (isTest) {
    // The shared test line: always for one chosen agent of this organization.
    if (parsed.data.agent_id === "number") return { error: "Choose an agent to test." };
    const { data: chosen } = await supabase.from("agents").select("id").eq("id", parsed.data.agent_id).eq("org_id", org.id).maybeSingle();
    if (!chosen) return { error: "That agent was not found." };
    fromDid = TEST_DID;
    agentId = chosen.id as string;
  } else {
    const { data: number } = await supabase
      .from("phone_numbers")
      .select("id, did_number, agent_id, agents(name)")
      .eq("id", parsed.data.phone_number_id)
      .eq("org_id", org.id)
      .maybeSingle();
    if (!number) return { error: "Choose which number the agent should call from." };
    fromDid = number.did_number as string;
    agentId = number.agent_id as string | null;
    if (parsed.data.agent_id !== "number") {
      const { data: chosen } = await supabase.from("agents").select("id").eq("id", parsed.data.agent_id).eq("org_id", org.id).maybeSingle();
      if (!chosen) return { error: "That agent was not found." };
      agentId = chosen.id as string;
    }
  }
  if (!agentId) return { error: "That number has no agent connected to it." };

  // Callbacks spend money. Off by default while billing is being set up; set
  // ENFORCE_WALLET_CHECK=true to require at least one minute of balance first. Test calls always
  // check, because they ring from a number everyone shares and are paid from the free credit.
  if (isTest || process.env.ENFORCE_WALLET_CHECK === "true") {
    const minutePaise = Number(process.env.CALL_RATE_PAISE_PER_MIN ?? 300);
    const { data: bal } = await supabase.from("wallet_balances").select("balance_paise").eq("org_id", org.id).maybeSingle();
    if (Number(bal?.balance_paise ?? 0) < minutePaise) {
      return { error: "Your wallet balance is too low to place a call. Add funds in Wallet first." };
    }
  }

  const admin = createAdminClient();
  if (isTest) {
    const limited = await testCallLimit(admin, org.id, dest.national);
    if (limited) return { error: limited };
  }
  const kind = isTest ? "test" : "callback";

  // Rate limits (callbacks are recorded as calls tagged metadata.kind = callback).
  if (!isTest) {
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
  }

  // Record the call first; its id travels with the call so the worker can attach to this row.
  const { data: call, error: insertError } = await admin
    .from("calls")
    .insert({
      org_id: org.id,
      agent_id: agentId,
      direction: "outbound",
      status: "initiated",
      from_number: fromDid,
      to_number: dest.national,
      // The worker reads the voice choice from here, not from the call's parameters, so it is
      // something this server decided and checked.
      metadata: { kind, requested_by: user.id, ...(voice ? { voice } : {}) },
    })
    .select("id")
    .single();
  if (insertError || !call) return { error: "Could not start the call. Please try again." };

  const result = await placeCall({
    did: fromDid,
    customerNumber: dest.national,
    params: { call_row_id: call.id, org_id: org.id, agent_id: agentId, kind },
  });
  if (!result.ok) {
    await admin.from("calls").update({ status: "failed", metadata: { kind, requested_by: user.id, ...(voice ? { voice } : {}), error: result.error } }).eq("id", call.id);
    revalidatePath("/dashboard", "layout");
    return { error: result.error };
  }
  await admin.from("calls").update({ metadata: { kind, requested_by: user.id, ...(voice ? { voice } : {}), queue_id: result.queueId ?? null } }).eq("id", call.id);
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

// ---- WhatsApp: connect a Cloud API number to an agent ------------------------------------------

const WhatsappSchema = z.object({
  phone_number_id: z.string().trim().regex(/^\d{8,20}$/, "Paste the Phone number ID from Meta (digits only)."),
  access_token: z.string().trim().min(20, "Paste the access token from Meta.").max(1000),
  display_number: z.string().trim().max(30),
  agent_id: z.string().uuid("Choose an agent for this number."),
});

export async function connectWhatsapp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = WhatsappSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, org } = await requireOrg();
  // The browser role may not write the access token column, so the row is written with the service
  // role, after checking here that the agent belongs to the signed-in user's organization.
  const { data: agent } = await supabase.from("agents").select("id").eq("id", parsed.data.agent_id).eq("org_id", org.id).maybeSingle();
  if (!agent) return { error: "Choose one of your agents." };

  const { error } = await createAdminClient()
    .from("whatsapp_accounts")
    .insert({
      org_id: org.id,
      agent_id: agent.id,
      phone_number_id: parsed.data.phone_number_id,
      access_token: parsed.data.access_token,
      display_number: parsed.data.display_number || null,
    });
  if (error) {
    return { error: error.code === "23505" ? "That WhatsApp number is already connected." : "Could not connect the number. Try again." };
  }
  revalidatePath("/dashboard/whatsapp");
  return {};
}

export async function removeWhatsapp(id: string) {
  const { supabase, org } = await requireOrg();
  await supabase.from("whatsapp_accounts").delete().eq("id", id).eq("org_id", org.id);
  revalidatePath("/dashboard/whatsapp");
}

export async function setWhatsappEnabled(id: string, enabled: boolean) {
  const { supabase, org } = await requireOrg();
  await supabase.from("whatsapp_accounts").update({ enabled }).eq("id", id).eq("org_id", org.id);
  revalidatePath("/dashboard/whatsapp");
}

// ---- Rented numbers: pick one from the provider's inventory and pay from the wallet -------------

const BuyNumberSchema = z.object({
  voicelink_did_id: z.coerce.number().int().positive(),
  did_number: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().min(10).max(15)),
  agent_id: z.string().uuid("Choose an agent for this number."),
});

export async function rentNumber(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!purchasesEnabled()) return { error: "Renting numbers is not open yet." };
  const parsed = BuyNumberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { voicelink_did_id, did_number, agent_id } = parsed.data;

  const { supabase, org } = await requireOrg();
  const { data: agent } = await supabase.from("agents").select("id").eq("id", agent_id).eq("org_id", org.id).maybeSingle();
  if (!agent) return { error: "That agent was not found." };

  const admin = createAdminClient();
  const day = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin.from("number_purchases").select("id", { count: "exact", head: true }).eq("org_id", org.id).gte("created_at", day);
  if ((count ?? 0) >= PURCHASES_PER_ORG_PER_DAY) return { error: "You have reached today's limit for renting numbers. Try again tomorrow." };

  // Never trust the id and number from the browser as a pair. Ask the provider, and use only an id
  // it returns for that exact number.
  const offer = await listAvailableNumbers(did_number, 20);
  if (!offer.ok) return { error: offer.error };
  const match = offer.numbers.find((n) => n.id === voicelink_did_id && n.did.slice(-10) === did_number.slice(-10));
  if (!match) return { error: "That number is no longer available. Please pick another." };

  // 1. Take the rent from the wallet and record the attempt, in one step.
  const reserved = await admin.rpc("reserve_number_purchase", { p_org: org.id, p_did: match.did, p_price: NUMBER_PRICE_PAISE });
  if (reserved.error) {
    const m = reserved.error.message;
    if (m.includes("insufficient_balance")) return { error: "Your wallet balance is too low. Add funds in Wallet, then try again." };
    if (m.includes("number_unavailable") || m.includes("number_purchases_one_live")) return { error: "That number was just taken. Please pick another." };
    console.log("[numbers] reserve failed", m);
    return { error: "Could not start the purchase. You have not been charged." };
  }
  const purchaseId = reserved.data as string;

  // 2. Buy it and point it at the voice bot.
  const bought = await buyNumber(match.id, match.did, maxProviderCostRupees());
  if (!bought.ok) {
    if (bought.stage === "before_purchase") {
      await admin.rpc("fail_number_purchase", { p_id: purchaseId, p_error: bought.error }); // refunds the wallet
      revalidatePath("/dashboard", "layout");
      return { error: `${bought.error} You have not been charged.` };
    }
    // Bought but not wired up: keep the payment, flag it for a person, and say so plainly.
    await admin.rpc("flag_number_purchase", { p_id: purchaseId, p_error: bought.error, p_voicelink_did_id: bought.voicelinkDidId });
    console.log("[numbers] NEEDS ATTENTION", JSON.stringify({ purchaseId, org: org.id, did: match.did, error: bought.error }));
    revalidatePath("/dashboard", "layout");
    return { error: "Your number was bought but needs a final setup step on our side. We have been alerted and will finish it. Contact support if it is not ready soon." };
  }

  // 3. Connect it to the organization and the chosen agent.
  const finished = await admin.rpc("finish_number_purchase", { p_id: purchaseId, p_voicelink_did_id: bought.number.voicelinkDidId, p_agent: agent.id });
  if (finished.error) {
    await admin.rpc("flag_number_purchase", { p_id: purchaseId, p_error: `finish failed: ${finished.error.message}`, p_voicelink_did_id: bought.number.voicelinkDidId });
    console.log("[numbers] NEEDS ATTENTION finish", JSON.stringify({ purchaseId, org: org.id, did: match.did, error: finished.error.message }));
    revalidatePath("/dashboard", "layout");
    return { error: "Your number was bought but could not be connected yet. We have been alerted and will finish it." };
  }
  revalidatePath("/dashboard", "layout");
  return { message: `+91 ${match.did.slice(-10, -5)} ${match.did.slice(-5)} is yours. It is connected to your agent and ready for calls.` };
}

/** Stop renting at the end of the paid month. The number keeps working until then; no refund. */
export async function cancelRental(id: string) {
  const { supabase, org } = await requireOrg();
  const { data: row } = await supabase.from("phone_numbers").select("id, source").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!row || row.source !== "purchased") return;
  await createAdminClient().from("phone_numbers").update({ cancel_at_period_end: true }).eq("id", id).eq("org_id", org.id);
  revalidatePath("/dashboard", "layout");
}

export async function keepRental(id: string) {
  const { supabase, org } = await requireOrg();
  const { data: row } = await supabase.from("phone_numbers").select("id, source").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!row || row.source !== "purchased") return;
  await createAdminClient().from("phone_numbers").update({ cancel_at_period_end: false }).eq("id", id).eq("org_id", org.id);
  revalidatePath("/dashboard", "layout");
}
