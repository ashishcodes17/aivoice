"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { AlertCircleIcon, CheckCircle2Icon, PhoneOutgoingIcon } from "lucide-react";
import { requestCallback, type ActionState } from "@/app/dashboard/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CALL_LANGUAGES, CALL_PROVIDERS, isSupported } from "@/lib/call-voices";

const AGENT_DEFAULT = "agent";
const NUMBER_AGENT = "number";
const providerItems = [{ value: AGENT_DEFAULT, label: "Agent's own voice" }, ...CALL_PROVIDERS];

export function CallbackForm({
  numbers,
  agents,
  fixedAgentId,
}: {
  numbers: { value: string; label: string }[];
  agents: { value: string; label: string }[];
  /** Inside the agent builder the call is always for that agent, so the agent picker is hidden. */
  fixedAgentId?: string;
}) {
  const agentItems = [{ value: NUMBER_AGENT, label: "The number's own agent" }, ...agents];
  const [state, action, pending] = useActionState<ActionState, FormData>(requestCallback, {});
  const formRef = useRef<HTMLFormElement>(null);
  // After a call is requested, clear the number and ask for permission again next time.
  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state]);
  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        // Submit through a handler instead of `action=`, because React clears an action's form
        // when it finishes, which would wipe what the user typed after a validation error.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className={fixedAgentId ? "space-y-4" : "space-y-4 rounded-2xl border bg-card p-5"}
    >
      {!fixedAgentId && (
        <div>
          <h2 className="font-heading font-semibold text-base tracking-tight">Test call</h2>
          <p className="mt-0.5 text-muted-foreground text-sm">Your agent will ring a phone so you can hear how it sounds.</p>
        </div>
      )}
      {fixedAgentId && <input type="hidden" name="agent_id" value={fixedAgentId} />}
      {state.error && (
        <Alert variant="error">
          <AlertCircleIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.message && (
        <Alert variant="success">
          <CheckCircle2Icon />
          <AlertDescription>
            {state.message}{" "}
            <Link href="/dashboard/calls" className="font-medium underline underline-offset-4">
              View calls
            </Link>
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-4">
        <Field>
          <FieldLabel>Call from</FieldLabel>
          <Select name="phone_number_id" items={numbers} defaultValue={numbers[0]?.value}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {numbers.map((n) => (
                <SelectItem key={n.value} value={n.value}>
                  {n.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Phone number to call</FieldLabel>
          <Input name="to" required inputMode="tel" autoComplete="tel" placeholder="98765 43210" />
          <FieldDescription>Indian mobile number.</FieldDescription>
        </Field>
        <label className="flex items-start gap-2.5 text-muted-foreground text-sm">
          <input type="checkbox" name="consent" className="mt-0.5 size-4 rounded border-input" />
          <span>This number is mine, or I have permission to call it.</span>
        </label>
        <Button type="submit" loading={pending} className="w-full">
          <PhoneOutgoingIcon />
          Call me
        </Button>
      </div>
      <details className="group rounded-xl border bg-muted/30 px-3.5 py-2.5 open:pb-4">
        <summary className="cursor-pointer select-none text-sm font-medium text-muted-foreground group-open:mb-4 group-open:text-foreground">Advanced options</summary>
      <div className="space-y-4">
      {!fixedAgentId && (
      <Field>
        <FieldLabel>Agent on this call</FieldLabel>
        <Select name="agent_id" items={agentItems} defaultValue={NUMBER_AGENT}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {agentItems.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <FieldDescription>Pick a different agent for this call only, without changing the number.</FieldDescription>
      </Field>
      )}
      {/* Remounted after a call is placed, which puts both dropdowns back to the agent's own settings. */}
      <VoiceFields key={state.message ?? "idle"} />
      </div>
      </details>
    </form>
  );
}

function VoiceFields() {
  const [provider, setProvider] = useState(AGENT_DEFAULT);
  const [language, setLanguage] = useState(AGENT_DEFAULT);
  // Offer only languages the chosen provider speaks.
  const languageItems = [
    { value: AGENT_DEFAULT, label: "Agent's own language" },
    ...CALL_LANGUAGES.filter((l) => provider === AGENT_DEFAULT || isSupported(provider, l.value)),
  ];
  return (
    <div className="space-y-4">
        <Field>
          <FieldLabel>Voice</FieldLabel>
          <Select
            name="tts_provider"
            items={providerItems}
            value={provider}
            onValueChange={(v) => {
              const next = String(v);
              setProvider(next);
              // Drop a language the new provider cannot speak.
              if (next !== AGENT_DEFAULT && language !== AGENT_DEFAULT && !isSupported(next, language)) setLanguage(AGENT_DEFAULT);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {providerItems.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <FieldDescription>Try a different voice for this call only.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Language</FieldLabel>
          <Select name="language" items={languageItems} value={language} onValueChange={(v) => setLanguage(String(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {languageItems.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <FieldDescription>The agent speaks this language on this call only.</FieldDescription>
        </Field>
      </div>
  );
}
