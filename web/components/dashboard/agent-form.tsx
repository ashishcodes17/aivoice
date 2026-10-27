"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { saveAgent, type ActionState } from "@/app/dashboard/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGES, SARVAM_TTS_MODELS, STT_PROVIDERS, TTS_PROVIDERS } from "@/lib/languages";
import type { Agent } from "@/lib/types";

const defaults: Omit<Agent, "id" | "created_at"> = {
  name: "",
  language: "en-IN",
  llm_model: "openai/gpt-4o-mini",
  stt_provider: "sarvam",
  tts_provider: "sarvam",
  tts_voice: "shubh",
  config: { tts_model: "bulbul:v3", tts_pace: 1 } as Agent["config"],
  first_message: "Hello! Thanks for calling. How can I help you today?",
  system_prompt:
    "You are a friendly receptionist. Greet callers, answer simple questions, and politely ask for their name and reason for calling. Keep every reply to one or two short sentences.",
};

function Choice({
  name,
  label,
  items,
  defaultValue,
}: {
  name: string;
  label: string;
  items: { value: string; label: string }[];
  defaultValue: string;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select name={name} defaultValue={defaultValue} items={items}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </Field>
  );
}

export function AgentForm({ agent }: { agent?: Agent }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAgent, {});
  const v = agent ?? defaults;

  return (
    <form action={action} className="max-w-2xl space-y-6">
      {agent && <input type="hidden" name="id" value={agent.id} />}
      {state.error && (
        <Alert variant="error">
          <AlertCircleIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Field>
        <FieldLabel>Name</FieldLabel>
        <Input name="name" required defaultValue={v.name} placeholder="Front desk" />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Choice name="language" label="Language" items={LANGUAGES} defaultValue={v.language} />
        <Choice name="stt_provider" label="Speech recognition" items={STT_PROVIDERS} defaultValue={v.stt_provider} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Choice name="tts_provider" label="Voice provider" items={TTS_PROVIDERS} defaultValue={v.tts_provider} />
        <Field>
          <FieldLabel>Voice</FieldLabel>
          <Input name="tts_voice" defaultValue={v.tts_voice ?? ""} placeholder="shubh" />
          <FieldDescription>A Sarvam speaker such as shubh, or an ElevenLabs voice ID.</FieldDescription>
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Choice name="tts_model" label="Sarvam voice model" items={SARVAM_TTS_MODELS} defaultValue={v.config?.tts_model ?? "bulbul:v3"} />
        <Field>
          <FieldLabel>Speaking speed</FieldLabel>
          <Input name="tts_pace" type="number" step="0.05" min="0.5" max="2" defaultValue={v.config?.tts_pace ?? 1} />
          <FieldDescription>1 is normal. Try 1.1 for a slightly quicker voice. v4 voices have their own names, like kavitha_te_conversation.</FieldDescription>
        </Field>
      </div>

      <Field>
        <FieldLabel>First message</FieldLabel>
        <Input name="first_message" defaultValue={v.first_message} placeholder="Hello! How can I help you today?" />
        <FieldDescription>What the agent says as soon as it picks up. Leave empty to wait for the caller.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Prompt</FieldLabel>
        <Textarea name="system_prompt" required rows={9} className="min-h-44" defaultValue={v.system_prompt} />
        <FieldDescription>Describe who the agent is and how it should behave on the phone.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Model</FieldLabel>
        <Input name="llm_model" required defaultValue={v.llm_model} placeholder="openai/gpt-4o-mini" />
        <FieldDescription>Any model ID from OpenRouter.</FieldDescription>
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" size="lg" loading={pending}>
          {agent ? "Save changes" : "Create agent"}
        </Button>
        <Button variant="ghost" size="lg" render={<Link href="/dashboard/agents" />}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
