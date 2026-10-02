"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarClock, Gift, Star, User } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import { useStarFriendsRedemptions } from "../hooks/use-star-friends";
import { RedemptionActions } from "./redemption-actions";
import { REDEMPTION_CHANNEL_LABELS, REDEMPTION_STATUS_LABELS, describeSnapshot } from "../utils/labels";

type RedemptionStatus = "PENDING" | "APPROVED" | "DELIVERED" | "REJECTED" | "CANCELED";

const STATUS_CHIP_CLASSES: Record<RedemptionStatus, string> = {
  PENDING: "text-warning",
  APPROVED: "text-info",
  DELIVERED: "text-success",
  REJECTED: "text-destructive",
  CANCELED: "text-muted-foreground",
};

const toDateTime = (value: string | Date) => format(new Date(value), "dd/MM/yyyy HH:mm");

export function RedemptionsQueue() {
  const [status, setStatus] = useState<RedemptionStatus>("PENDING");
  const redemptions = useStarFriendsRedemptions(status);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Pedidos feitos pelo Astro ou pelo portal chegam aqui para aprovação. As stars só saem do saldo quando
        o resgate é aprovado; cancelar um resgate aprovado devolve as stars (estorno).
      </p>
      <div role="tablist" className="scroll-hidden-x -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {(Object.keys(REDEMPTION_STATUS_LABELS) as RedemptionStatus[]).map((statusKey) => {
          const isActive = statusKey === status;
          return (
            <button
              key={statusKey}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setStatus(statusKey)}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
                isActive ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {REDEMPTION_STATUS_LABELS[statusKey]}
            </button>
          );
        })}
      </div>
      {redemptions.isLoading && (
        <div className="flex justify-center py-6">
          <OrbitaSpinner className="size-5 text-muted-foreground" />
        </div>
      )}
      {redemptions.data?.redemptions.length === 0 && (
        <p className="rounded-[20px] border border-line bg-card p-4 text-center text-sm text-muted-foreground">
          Nada por aqui.
        </p>
      )}
      {redemptions.data?.redemptions.map((redemption) => (
        <div key={redemption.id} className="flex flex-col gap-3 rounded-[20px] border border-line bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
              <Gift className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{describeSnapshot(redemption.rewardSnapshot)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium",
                    STATUS_CHIP_CLASSES[redemption.status as RedemptionStatus],
                  )}
                >
                  {REDEMPTION_STATUS_LABELS[redemption.status]}
                </span>
                <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted-foreground">
                  {REDEMPTION_CHANNEL_LABELS[redemption.requestedVia]}
                </span>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-lg font-bold text-warning">
              <Star className="size-4 fill-current" />
              {redemption.costStars}
            </span>
          </div>

          <div className="grid gap-2 rounded-2xl bg-muted p-3 text-sm sm:grid-cols-2">
            <div className="flex min-w-0 items-center gap-2">
              <User className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate font-medium">{redemption.member.name}</p>
                <p className="truncate text-xs text-muted-foreground">{redemption.member.phone}</p>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate">{toDateTime(redemption.createdAt)}</p>
                <p className="truncate text-xs text-muted-foreground">Pedido por {redemption.requestedByName}</p>
              </div>
            </div>
          </div>

          {(redemption.decidedByName || redemption.deliveredByName || redemption.decisionReason) && (
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              {redemption.decidedByName && (
                <p>
                  Decidido por {redemption.decidedByName}
                  {redemption.decidedAt && ` em ${toDateTime(redemption.decidedAt)}`}
                </p>
              )}
              {redemption.deliveredByName && (
                <p>
                  Entregue por {redemption.deliveredByName}
                  {redemption.deliveredAt && ` em ${toDateTime(redemption.deliveredAt)}`}
                </p>
              )}
              {redemption.decisionReason && <p>Motivo: {redemption.decisionReason}</p>}
            </div>
          )}

          <RedemptionActions redemption={redemption} />
        </div>
      ))}
    </div>
  );
}
