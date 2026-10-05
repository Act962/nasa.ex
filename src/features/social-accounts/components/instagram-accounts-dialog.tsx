"use client";

import { Instagram } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SocialAccountsManager } from "./social-accounts-manager";

/** Contas do Instagram abertas a partir do cartão dos Satélites (spec 0069, RF-1). */
export function InstagramAccountsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="size-5" />
            Contas do Instagram
          </DialogTitle>
          <DialogDescription>
            Conecte uma ou mais contas. As mesmas contas ficam disponíveis no Comments e no Planner.
          </DialogDescription>
        </DialogHeader>
        {open && <SocialAccountsManager />}
      </DialogContent>
    </Dialog>
  );
}
