"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { AlertCircleIcon, CheckCircle2Icon, PhoneOutgoingIcon } from "lucide-react";
import { requestCallback, type ActionState } from "@/app/dashboard/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CallbackForm({ numbers }: { numbers: { value: string; label: string }[] }) {
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
      className="space-y-5 rounded-xl border bg-card p-5"
    >
      <div>
        <h2 className="font-medium text-sm">Get a call from your agent</h2>
        <p className="mt-1 text-muted-foreground text-sm">Enter a phone number and your agent will call it, so you can hear how it sounds.</p>
      </div>
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
      <div className="grid gap-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
        <Button type="submit" size="lg" loading={pending} className="sm:mb-[1.1rem]">
          <PhoneOutgoingIcon />
          Call me
        </Button>
      </div>
      <label className="flex items-start gap-2.5 text-muted-foreground text-sm">
        <input type="checkbox" name="consent" className="mt-0.5 size-4 rounded border-input" />
        <span>This number is mine, or I have permission to call it.</span>
      </label>
    </form>
  );
}
