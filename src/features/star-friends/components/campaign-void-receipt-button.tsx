"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useVoidStarFriendsReceipt } from "../hooks/use-star-friends-campaign";
import { formatCents } from "../utils/campaign";

const MIN_REASON_LENGTH = 3;

type VoidableReceipt = { id: string; totalCents: number | null; member: { name: string }; luckyNumbers: { status: string }[] };

export function CampaignVoidReceiptButton({ receipt, isFirstInList }: { receipt: VoidableReceipt; isFirstInList: boolean }) {
  const voidReceipt = useVoidStarFriendsReceipt();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const validNumbers = receipt.luckyNumbers.filter((luckyNumber) => luckyNumber.status === "VALID").length;
  const isReasonValid = reason.trim().length >= MIN_REASON_LENGTH;

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(nextIsOpen) => {
        setIsOpen(nextIsOpen);
        if (!nextIsOpen) setReason("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 self-start rounded-full px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          data-guide={isFirstInList ? GUIDE_ANCHORS.starFriendsCampaignVoidReceipt.id : undefined}
        >
          <Ban className="size-3.5" /> Anular cupom
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Anular o cupom{receipt.totalCents !== null ? ` de ${formatCents(receipt.totalCents)}` : ""}?</AlertDialogTitle>
          <AlertDialogDescription>
            Os {validNumbers} número(s) deste cupom de {receipt.member.name} deixam de concorrer, e as stars que ele rendeu são estornadas do saldo. Se
            a sobra deste cupom ajudou a formar números de outros cupons, esses também saem. Não dá para desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input placeholder="Motivo (obrigatório). Ex.: nota não foi paga" value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            className="rounded-full bg-destructive text-white hover:bg-destructive/90"
            disabled={!isReasonValid || voidReceipt.isPending}
            onClick={() =>
              voidReceipt.mutate(
                { receiptId: receipt.id, reason: reason.trim() },
                {
                  onSuccess: (result) => {
                    setIsOpen(false);
                    toast.success(`Cupom anulado: ${result.numbersVoided} número(s) fora do sorteio.`, {
                      description: result.starsReversed > 0 ? `${result.starsReversed} star(s) estornadas do saldo.` : undefined,
                    });
                  },
                  onError: (error) => toast.error(error.message),
                },
              )
            }
          >
            {voidReceipt.isPending && <OrbitaSpinner className="size-4" />} Anular cupom
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
