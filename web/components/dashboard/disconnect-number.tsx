"use client";

import { UnlinkIcon } from "lucide-react";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Disconnecting stops the number being answered, so it asks first. */
export function DisconnectNumber({ label, action }: { label: string; action: () => void | Promise<void> }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive-foreground" />}>
        <UnlinkIcon /> Disconnect
      </AlertDialogTrigger>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect {label}?</AlertDialogTitle>
          <AlertDialogDescription>Calls to this number will stop being answered by your agent. You can connect it again any time.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="outline" />}>Cancel</AlertDialogClose>
          <form action={action}>
            <Button type="submit" variant="destructive" className="w-full sm:w-auto">
              Disconnect
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
