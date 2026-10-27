"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/dashboard";
import { LANGUAGES, SARVAM_TTS_MODELS, STT_PROVIDERS, TTS_PROVIDERS } from "@/lib/languages";

export type ActionState = { error?: string };

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
  tts_pace: z.coerce.number().min(0.5, "Speed must be between 0.5 and 2.").max(2, "Speed must be between 0.5 and 2."),
});

export async function saveAgent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = AgentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, org } = await requireOrg();
  const id = String(formData.get("id") ?? "");
  const { tts_model, tts_pace, ...fields } = parsed.data;
  const row = { ...fields, tts_voice: fields.tts_voice || null, config: { tts_model, tts_pace } };

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
