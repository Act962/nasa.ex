"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useApproveTrafegoOrderReview,
  useMarkTrafegoOrderPublished,
} from "@/features/trafego/hooks/use-trafego-admin";

/** Saída de emergência da avaliação do Claude (spec 0132, RF-9): aprovar à mão e marcar como publicado. */
export function OrderReviewCard({
  order,
}: {
  order: {
    id: string;
    status: string;
    reviewRequestedAt: Date | null;
    reviewFingerprint: string | null;
    metaCampaignExternalId: string | null;
  };
}) {
  const approve = useApproveTrafegoOrderReview();
  const markPublished = useMarkTrafegoOrderPublished();
  const [campaignId, setCampaignId] = useState("");
  const [openedAt] = useState(() => Date.now());

  const isWaitingReview = order.status === "IN_REVIEW" && order.reviewRequestedAt;
  const isWaitingPublish = order.status === "SCHEDULED" && order.reviewFingerprint && !order.metaCampaignExternalId;
  if (!isWaitingReview && !isWaitingPublish) return null;

  const waitingHours = order.reviewRequestedAt
    ? Math.floor((openedAt - new Date(order.reviewRequestedAt).getTime()) / 3_600_000)
    : null;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Avaliação do Claude</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          A rotina avalia e publica a cada 2 horas. Use os botões só se ela parar.
        </p>
      </div>
      {isWaitingReview && (
        <div className="space-y-2">
          <p className="text-xs">Esperando avaliação{waitingHours !== null && ` há ${waitingHours} h`}.</p>
          <Button
            size="sm"
            variant="outline"
            disabled={approve.isPending}
            onClick={() =>
              approve.mutate(
                { orderId: order.id },
                { onSuccess: () => toast.success("Aprovado. O cliente vê \"Aprovado, publicar\"."), onError: (error) => toast.error(error.message) },
              )
            }
          >
            <CheckCircle2 className="mr-1 size-3.5" />
            Aprovar à mão
          </Button>
        </div>
      )}
      {isWaitingPublish && (
        <div className="space-y-2">
          <p className="text-xs">Aprovado. Depois que o cliente liberar e a campanha for criada na Meta, marque como publicado.</p>
          <div className="flex gap-2">
            <Input
              value={campaignId}
              onChange={(event) => setCampaignId(event.target.value.replace(/\D/g, ""))}
              placeholder="Id da campanha na Meta"
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              disabled={markPublished.isPending || campaignId.length < 6}
              onClick={() =>
                markPublished.mutate(
                  { orderId: order.id, metaCampaignId: campaignId },
                  { onSuccess: () => toast.success("Pedido no ar."), onError: (error) => toast.error(error.message) },
                )
              }
            >
              <Rocket className="mr-1 size-3.5" />
              Marcar como publicado
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
