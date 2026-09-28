"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Gift, Loader2, MinusCircle, PlusCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdjustStarFriendsStars,
  useRequestStarFriendsRedemption,
  useStarFriendsByLead,
} from "../hooks/use-star-friends";
import { useStarFriendsPermissions } from "../hooks/use-star-friends-permissions";
import {
  ACTOR_TYPE_LABELS,
  LEDGER_TYPE_LABELS,
  REDEMPTION_STATUS_LABELS,
  REWARD_TYPE_LABELS,
  describeSnapshot,
  formatStars,
} from "../utils/labels";

interface LeadStarFriendsCardProps {
  leadId: string;
  channel?: "CONSULTANT" | "CHAT";
  onRedeemed?: (confirmationText: string) => void;
  compact?: boolean;
}

export function LeadStarFriendsCard({
  leadId,
  channel = "CONSULTANT",
  onRedeemed,
  compact = false,
}: LeadStarFriendsCardProps) {
  const starFriends = useStarFriendsByLead(leadId);
  const requestRedemption = useRequestStarFriendsRedemption();
  const [adjustDirection, setAdjustDirection] = useState<"credit" | "debit" | null>(null);
  const permissions = useStarFriendsPermissions();

  const data = starFriends.data;
  if (starFriends.isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  if (!data?.isActive || !permissions.canView) return null;

  const handleRedeem = (reward: { id: string; name: string; costStars: number }) => {
    requestRedemption.mutate(
      { leadId, rewardId: reward.id, channel },
      {
        onSuccess: () => {
          toast.success(`Resgate de "${reward.name}" registrado`);
          onRedeemed?.(
            `🎁 Troca confirmada no ${data.programName}! Você trocou ${reward.costStars} stars por *${reward.name}*. Saldo restante: ${data.balance - reward.costStars} stars.`,
          );
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-amber-500" />
              {data.programName}
            </CardTitle>
            <CardDescription>
              {data.hasPhone
                ? "Cada compra paga vira star. O cliente troca pelos prêmios abaixo."
                : "Cadastre o telefone do lead para ele participar do programa."}
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-amber-500">{data.balance}</p>
            <p className="text-xs text-muted-foreground">stars disponíveis</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Lista de troca</p>
          {data.rewards.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum prêmio cadastrado em STAR FRIENDS → Lista de troca.</p>
          )}
          {data.rewards.map((reward) => {
            const isAffordable = data.balance >= reward.costStars && (reward.stock === null || reward.stock > 0);
            return (
              <div key={reward.id} className="flex items-center gap-3 rounded-lg border p-2">
                <Gift className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{reward.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {REWARD_TYPE_LABELS[reward.type]} · {reward.costStars} stars
                    {reward.stock !== null ? ` · ${reward.stock} em estoque` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isAffordable ? "default" : "outline"}
                  disabled={
                    !isAffordable || requestRedemption.isPending || !data.hasPhone || !permissions.canRedeemAndCredit
                  }
                  onClick={() => handleRedeem(reward)}
                >
                  Resgatar
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!data.hasPhone || !permissions.canRedeemAndCredit}
            onClick={() => setAdjustDirection("credit")}
          >
            <PlusCircle className="size-4" /> Lançar stars
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!data.hasPhone || !permissions.canDebitAndCancel}
            onClick={() => setAdjustDirection("debit")}
          >
            <MinusCircle className="size-4" /> Retirar stars
          </Button>
        </div>

        {!compact && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Extrato</p>
            {data.entries.length === 0 && <p className="text-sm text-muted-foreground">Sem movimentações ainda.</p>}
            {data.entries.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 border-b pb-2 text-sm last:border-0">
                <div className="min-w-0">
                  <p className="font-medium">
                    {LEDGER_TYPE_LABELS[entry.type]}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm")} · {ACTOR_TYPE_LABELS[entry.actorType]}: {entry.actorName}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.reason ?? describeSnapshot(entry.itemsSnapshot)}
                  </p>
                </div>
                <span className={entry.stars > 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-500"}>
                  {formatStars(entry.stars)}
                </span>
              </div>
            ))}
            {data.redemptions.length > 0 && <p className="pt-2 text-sm font-medium">Resgates</p>}
            {data.redemptions.map((redemption) => (
              <div key={redemption.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{describeSnapshot(redemption.rewardSnapshot)}</span>
                <Badge variant="outline">{REDEMPTION_STATUS_LABELS[redemption.status]}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <AdjustStarsDialog
        leadId={leadId}
        direction={adjustDirection}
        onClose={() => setAdjustDirection(null)}
      />
    </Card>
  );
}

function AdjustStarsDialog({
  leadId,
  direction,
  onClose,
}: {
  leadId: string;
  direction: "credit" | "debit" | null;
  onClose: () => void;
}) {
  const adjust = useAdjustStarFriendsStars();
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");
  const isCredit = direction === "credit";

  const handleSubmit = () => {
    const stars = Number.parseInt(amount, 10);
    if (!Number.isInteger(stars) || stars <= 0) {
      toast.error("Informe uma quantidade válida.");
      return;
    }
    adjust.mutate(
      { leadId, stars: isCredit ? stars : -stars, reason },
      {
        onSuccess: () => {
          toast.success(isCredit ? "Stars lançadas" : "Stars retiradas");
          setAmount("1");
          setReason("");
          onClose();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Dialog open={direction !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCredit ? "Lançar stars manualmente" : "Retirar stars"}</DialogTitle>
          <DialogDescription>
            Fica registrado no histórico com o seu usuário, data, hora e o motivo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} />
          <Textarea
            placeholder="Motivo (obrigatório) — ex.: compra no balcão, cortesia, correção"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={adjust.isPending || reason.trim().length < 5}>
            {adjust.isPending && <Loader2 className="size-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
