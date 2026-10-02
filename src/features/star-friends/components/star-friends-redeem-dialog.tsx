"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LeadStarFriendsCard } from "./lead-star-friends-card";

interface StarFriendsRedeemDialogProps {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertMessage: (text: string) => void;
}

// Aberto pelo "+" do chat: o resgate é registrado e a confirmação vai para o
// campo de mensagem, para o consultor revisar e enviar.
export function StarFriendsRedeemDialog({
  leadId,
  open,
  onOpenChange,
  onInsertMessage,
}: StarFriendsRedeemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:px-4 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DialogHeader className="text-left">
          <DialogTitle>Resgatar STAR FRIENDS</DialogTitle>
        </DialogHeader>
        {open && (
          <LeadStarFriendsCard
            leadId={leadId}
            channel="CHAT"
            compact
            onRedeemed={(text) => {
              onInsertMessage(text);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
