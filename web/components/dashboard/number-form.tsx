"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
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
    <form
      ref={ref}
      onSubmit={(e) => {
        // Submit through a handler instead of `action=`, because React clears an action's form
        // when it finishes, which would wipe what the user typed after a validation error.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-4 rounded-2xl border bg-card p-5"
    >
      <div>
        <h2 className="font-heading font-semibold text-base tracking-tight">Connect a number</h2>
        <p className="mt-0.5 text-muted-foreground text-sm">Choose which agent answers calls to it.</p>
      </div>
      {state.error && (
        <Alert variant="error">
          <AlertCircleIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-4">
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
        <Button type="submit" loading={pending} className="w-full">
          <PlusIcon />
          Connect
        </Button>
      </div>
    </form>
  );
}
