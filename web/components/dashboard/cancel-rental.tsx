"use client";

import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function CancelRental({ label, endsOn, action }: { label: string; endsOn: string; action: () => void | Promise<void> }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive-foreground" />}>Cancel rental</AlertDialogTrigger>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel the rental of {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            It keeps working until {endsOn}, the end of the month you have paid for. After that it is released and cannot be recovered. The rent paid is not refunded.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="outline" />}>Keep it</AlertDialogClose>
          <form action={action}>
            <Button type="submit" variant="destructive" className="w-full sm:w-auto">
              Cancel rental
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
