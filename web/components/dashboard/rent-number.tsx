"use client";

import { startTransition, useActionState, useState } from "react";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { rentNumber, type ActionState } from "@/app/dashboard/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogHeader, DialogPanel, DialogPopup, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NUMBER_PRICE_LABEL } from "@/lib/numbers";

/** Renting costs money every month, so it always goes through a confirmation. */
export function RentNumber({ id, did, label, agents, enabled }: { id: number; did: string; label: string; agents: { value: string; label: string }[]; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(rentNumber, {});
  const [agent, setAgent] = useState(agents[0]?.value ?? "");

  if (!enabled) {
    return (
      <Button type="button" variant="outline" size="sm" disabled>
        Coming soon
      </Button>
    );
  }
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Rent
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Rent {label}?</DialogTitle>
            <DialogDescription>
              {NUMBER_PRICE_LABEL} is taken from your wallet now, and again each month. Cancel any time from the Numbers page; the number stays yours until the month you paid for ends.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <form
              id="rent-form"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                startTransition(() => action(data));
              }}
              className="space-y-4"
            >
              <input type="hidden" name="voicelink_did_id" value={id} />
              <input type="hidden" name="did_number" value={did} />
              <input type="hidden" name="agent_id" value={agent} />
              <Field>
                <FieldLabel>Agent that answers it</FieldLabel>
                <Select items={agents} value={agent} onValueChange={(v) => setAgent(String(v))}>
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
              {state.error && (
                <Alert variant="error">
                  <AlertCircleIcon />
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}
              {state.message && (
                <Alert variant="success">
                  <CheckCircle2Icon />
                  <AlertDescription>{state.message}</AlertDescription>
                </Alert>
              )}
            </form>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{state.message ? "Done" : "Cancel"}</DialogClose>
            {!state.message && (
              <Button type="submit" form="rent-form" loading={pending} disabled={!agent}>
                Pay {NUMBER_PRICE_LABEL} and rent
              </Button>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}
