"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useApproveTrafegoRecommendation,
  useTrafegoApprovalPermission,
} from "@/features/trafego/hooks/use-trafego-approvals";
import { REVIEW_SLA_HOURS } from "@/features/trafego/lib/order-review";
import { PendingApprovalBadge } from "./pending-approval-badge";

/**
 * Recomendação da equipe esperando o cliente (spec 0130, RF-8, RF-9). Aprovar autoriza a equipe a
 * seguir com a publicação; responder abre o suporte.
 */
export function PendingApprovalCard({
  recommendation,
  onReply,
  isReviewApproval = false,
}: {
  recommendation: { id: string; detail: string | null; createdAt: Date };
  onReply: () => void;
  /** Avaliação do Claude aprovada (spec 0132, RF-4): aprovar = liberar a publicação. */
  isReviewApproval?: boolean;
}) {
  const { data: permission } = useTrafegoApprovalPermission();
  const approve = useApproveTrafegoRecommendation();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const canApprove = permission?.canApprove === true;

  function runApprove() {
    approve.mutate(
      { eventId: recommendation.id },
      {
        onSuccess: (result) =>
          toast.success(
            result.isApproved
              ? isReviewApproval
                ? `Liberado. A equipe publica em até ${REVIEW_SLA_HOURS} horas.`
                : "Aprovado. A equipe segue com a publicação."
              : "Essa recomendação já foi respondida.",
          ),
        onError: (error) => toast.error(error.message),
        onSettled: () => setIsConfirmOpen(false),
      },
    );
  }

  return (
    <div className="rounded-[20px] border border-warning/40 bg-warning/[0.06] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PendingApprovalBadge />
        <span className="text-xs text-muted-foreground">
          Enviada em {recommendation.createdAt.toLocaleDateString("pt-BR")}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold">
        {isReviewApproval ? "A equipe aprovou seu anúncio" : "A equipe recomenda antes de publicar"}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{recommendation.detail}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {canApprove ? (
          <Button className="h-10 rounded-full" onClick={() => setIsConfirmOpen(true)} disabled={approve.isPending}>
            <CheckCircle2 className="size-4" />
            {isReviewApproval ? "Aprovado, publicar" : "Aprovar"}
          </Button>
        ) : permission ? (
          <p className="self-center text-xs text-muted-foreground">Só o dono ou um admin da empresa pode aprovar.</p>
        ) : null}
        <Button variant="outline" className="h-10 rounded-full" onClick={onReply}>
          <MessageSquare className="size-4" />
          Responder
        </Button>
      </div>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={isReviewApproval ? "Liberar a publicação?" : "Aprovar a recomendação?"}
        description={
          isReviewApproval
            ? `Autorizo a equipe a publicar este anúncio na Meta. Ela publica em até ${REVIEW_SLA_HOURS} horas e a Meta ainda revisa antes de entregar. Fica registrado no histórico da campanha.`
            : "Aprovo e autorizo a equipe a seguir com a publicação do anúncio com essas mudanças. Fica registrado no histórico da campanha."
        }
        confirmText={isReviewApproval ? "Aprovado, publicar" : "Aprovar"}
        onConfirm={runApprove}
        onCancel={() => setIsConfirmOpen(false)}
        isLoading={approve.isPending}
      />
    </div>
  );
}
