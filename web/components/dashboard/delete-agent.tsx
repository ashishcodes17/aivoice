"use client";

import { Trash2Icon } from "lucide-react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Danger zone: deleting needs a second, deliberate click in a confirmation dialog. */
export function DeleteAgent({ name, action }: { name: string; action: () => void | Promise<void> }) {
  return (
    <section id="danger" className="mt-6 scroll-mt-24 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <h2 className="font-heading font-semibold text-base tracking-tight">Danger zone</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Deleting this agent cannot be undone. Numbers connected to it stop being answered until you connect them to another agent.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger render={<Button type="button" variant="destructive-outline" />}>
            <Trash2Icon /> Delete agent
          </AlertDialogTrigger>
          <AlertDialogPopup>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {name || "this agent"}?</AlertDialogTitle>
              <AlertDialogDescription>
                The agent and its instructions will be removed for good. Its call history stays. Any numbers connected to it will stop being answered.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button type="button" variant="outline" />}>Cancel</AlertDialogClose>
              <form action={action}>
                <Button type="submit" variant="destructive" className="w-full sm:w-auto">
                  Yes, delete agent
                </Button>
              </form>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialog>
      </div>
    </section>
  );
}
