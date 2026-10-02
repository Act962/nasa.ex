"use client";

import { TierPlanet } from "./tier-planet";
import { isTierReached, TIER_LABELS } from "../utils/tiers";
import { RedemptionActions } from "./redemption-actions";
import { useState } from "react";
import { format } from "date-fns";
import { Gift, MinusCircle, PlusCircle, Sparkles } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
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
  REDEMPTION_CHANNEL_LABELS,
  REDEMPTION_STATUS_LABELS,
  REWARD_TYPE_LABELS,
  describeSnapshot,
  formatStars,
} from "../utils/labels";

const BOTTOM_SHEET_DIALOG_CLASS =
  "flex max-h-[88dvh] flex-col gap-0 p-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[26px]";

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
          <OrbitaSpinner className="size-5 text-muted-foreground" />
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
              <Sparkles className="size-4 text-warning" />
              {data.programName}
            </CardTitle>
            <CardDescription>
              {data.hasPhone
                ? "Cada compra paga vira star. O cliente troca pelos prêmios abaixo."
                : "Cadastre o telefone do lead para ele participar do programa."}
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-warning">{data.balance}</p>
            <p className="text-xs text-muted-foreground">stars disponíveis</p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-[18px] bg-muted px-3 py-2 text-xs">
          <TierPlanet tier={data.tier} size={22} />
          <span className="shrink-0 font-semibold">Cliente {TIER_LABELS[data.tier]}</span>
          <span className="min-w-0 text-muted-foreground">
            · {data.lifetimeStars} stars na vida
            {data.nextTier ? ` · faltam ${data.starsToNextTier} para ${TIER_LABELS[data.nextTier]}` : " · nível máximo"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Lista de troca</p>
          {data.rewards.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum prêmio cadastrado em STAR FRIENDS → Lista de troca.</p>
          )}
          {data.rewards.map((reward) => {
            const isTierLocked = !isTierReached(data.tier, reward.minTier);
            const isAffordable =
              !isTierLocked && data.balance >= reward.costStars && (reward.stock === null || reward.stock > 0);
            return (
              <div key={reward.id} className="flex items-center gap-3 rounded-[18px] border border-line bg-card p-2.5">
                <Gift className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{reward.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {REWARD_TYPE_LABELS[reward.type]} · {reward.costStars} stars
                    {reward.stock !== null ? ` · ${reward.stock} em estoque` : ""}
                    {isTierLocked ? ` · só ${TIER_LABELS[reward.minTier]} ou acima` : ""}
                  </p>
                </div>
                <Button
                  variant={isAffordable ? "default" : "outline"}
                  className="h-9 shrink-0 rounded-full px-4"
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

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button
            variant="outline"
            className="h-11 rounded-full sm:h-9"
            disabled={!data.hasPhone || !permissions.canRedeemAndCredit}
            onClick={() => setAdjustDirection("credit")}
          >
            <PlusCircle className="size-4" /> Lançar stars
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-full sm:h-9"
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
                <span className={entry.stars > 0 ? "font-semibold text-success" : "font-semibold text-destructive"}>
                  {formatStars(entry.stars)}
                </span>
              </div>
            ))}
            {data.redemptions.length > 0 && <p className="pt-2 text-sm font-medium">Resgates</p>}
            {data.redemptions.map((redemption) => (
              <div key={redemption.id} className="flex flex-col gap-2 rounded-[18px] border border-line bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{describeSnapshot(redemption.rewardSnapshot)}</p>
                    <p className="text-xs text-muted-foreground">
                      {redemption.costStars} stars · {REDEMPTION_CHANNEL_LABELS[redemption.requestedVia]}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 rounded-full">{REDEMPTION_STATUS_LABELS[redemption.status]}</Badge>
                </div>
                <RedemptionActions redemption={redemption} />
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
      <DialogContent className={BOTTOM_SHEET_DIALOG_CLASS}>
        <DialogHeader className="px-6 pt-6 pb-4 text-left">
          <DialogTitle>{isCredit ? "Lançar stars manualmente" : "Retirar stars"}</DialogTitle>
          <DialogDescription>
            Fica registrado no histórico com o seu usuário, data, hora e o motivo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-4">
          <Input
            type="number"
            min={1}
            aria-label="Quantidade de stars"
            className="h-11 rounded-full"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <Textarea
            placeholder="Motivo (obrigatório) — ex.: compra no balcão, cortesia, correção"
            className="rounded-[18px]"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <DialogFooter className="flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row">
          <Button variant="outline" className="h-12 w-full rounded-full sm:h-9 sm:w-auto" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="h-12 w-full rounded-full sm:h-9 sm:w-auto"
            onClick={handleSubmit}
            disabled={adjust.isPending || reason.trim().length < 5}
          >
            {adjust.isPending && <OrbitaSpinner className="size-4" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
