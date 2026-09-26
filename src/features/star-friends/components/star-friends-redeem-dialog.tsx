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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
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
