"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { AlertCircleIcon, PlusIcon } from "lucide-react";
import { connectWhatsapp, type ActionState } from "@/app/dashboard/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";

export function WhatsappForm({ agents, webhookUrl }: { agents: { value: string; label: string }[]; webhookUrl: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(connectWhatsapp, {});
  const ref = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) ref.current?.reset();
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-5 rounded-xl border bg-card p-5"
    >
      <div className="space-y-1">
        <h2 className="font-medium text-sm">Connect a WhatsApp number</h2>
        <p className="text-muted-foreground text-xs">
          In Meta&apos;s WhatsApp setup, set the webhook callback URL to{" "}
          <span className="break-all font-mono text-foreground">{webhookUrl}</span> and subscribe to <b>messages</b>.
        </p>
      </div>
      {state.error && (
        <Alert variant="error">
          <AlertCircleIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel>Phone number ID</FieldLabel>
          <Input name="phone_number_id" required inputMode="numeric" placeholder="109876543210987" autoComplete="off" />
          <FieldDescription>From Meta: WhatsApp, API Setup. Not the phone number itself.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Display number (optional)</FieldLabel>
          <Input name="display_number" placeholder="+91 98765 43210" />
          <FieldDescription>Only shown in this dashboard.</FieldDescription>
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel>Access token</FieldLabel>
          <Input name="access_token" type="password" required autoComplete="off" placeholder="EAAG..." />
          <FieldDescription>Stored on the server only; it is never shown again.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Agent</FieldLabel>
          <Select name="agent_id" items={agents} defaultValue={agents[0]?.value}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {agents.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </Field>
      </div>
      <Button type="submit" loading={pending}>
        <PlusIcon />
        Connect
      </Button>
    </form>
  );
}
