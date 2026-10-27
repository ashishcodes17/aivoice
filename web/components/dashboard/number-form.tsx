"use client";

import { useActionState, useEffect, useRef } from "react";
import { AlertCircleIcon, PlusIcon } from "lucide-react";
import { addNumber, type ActionState } from "@/app/dashboard/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NumberForm({ agents }: { agents: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addNumber, {});
  const ref = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  // Clear the form after a successful add.
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) ref.current?.reset();
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form ref={ref} action={action} className="space-y-5 rounded-xl border bg-card p-5">
      <h2 className="font-medium text-sm">Connect a number</h2>
      {state.error && (
        <Alert variant="error">
          <AlertCircleIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field>
          <FieldLabel>Phone number</FieldLabel>
          <Input name="did_number" required inputMode="tel" placeholder="919876543210" />
          <FieldDescription>With country code, digits only.</FieldDescription>
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
        <Button type="submit" size="lg" loading={pending} className="sm:mb-[1.1rem]">
          <PlusIcon />
          Connect
        </Button>
      </div>
    </form>
  );
}
