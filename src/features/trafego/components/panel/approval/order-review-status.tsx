"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Clock, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useApplyTrafegoReviewFixes, useTrafegoApprovalPermission } from "@/features/trafego/hooks/use-trafego-approvals";
import {
  REVIEW_SLA_HOURS,
  canApproveByApplyingFixes,
  describeReviewFixes,
  readOrderReviewFixes,
} from "@/features/trafego/lib/order-review";
import { PendingApprovalBadge } from "./pending-approval-badge";
import { PendingApprovalCard } from "./pending-approval-card";

/**
 * Onde o pedido está na avaliação do Claude (spec 0132, RF-1, RF-4, RF-5). Sem avaliação, cai no cartão de
 * recomendação da 0130 como sempre.
 */

interface ReviewOrder {
  id: string;
  status: string;
  reviewRequestedAt: Date | null;
  reviewFingerprint: string | null;
  reviewFixes: unknown;
  reviewNotes: string[];
}

type Recommendation = { id: string; detail: string | null; createdAt: Date };

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-[20px] border bg-card p-4 text-sm text-muted-foreground">
      <Clock className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}

export function OrderReviewStatus({
  order,
  pendingApproval,
  isReleased,
  onReply,
}: {
  order: ReviewOrder;
  pendingApproval: Recommendation | null;
  isReleased: boolean;
  onReply: () => void;
}) {
  const isReviewFlow = Boolean(order.reviewFingerprint);

  if (order.status === "IN_REVIEW" && order.reviewRequestedAt) {
    return <InfoNote>A equipe avalia seu anúncio em até {REVIEW_SLA_HOURS} horas. Você recebe um aviso quando terminar.</InfoNote>;
  }
  if (isReviewFlow && order.status === "CHANGES_REQUESTED" && pendingApproval) {
    return <ReviewChangesCard order={order} recommendation={pendingApproval} onReply={onReply} />;
  }
  if (pendingApproval) {
    return (
      <PendingApprovalCard
        recommendation={pendingApproval}
        onReply={onReply}
        isReviewApproval={isReviewFlow && order.status === "SCHEDULED"}
      />
    );
  }
  if (isReviewFlow && order.status === "SCHEDULED" && isReleased) {
    return <InfoNote>Publicação liberada. A equipe coloca seu anúncio no ar em até {REVIEW_SLA_HOURS} horas.</InfoNote>;
  }
  return null;
}

function ReviewChangesCard({ order, recommendation, onReply }: { order: ReviewOrder; recommendation: Recommendation; onReply: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: permission } = useTrafegoApprovalPermission();
  const applyFixes = useApplyTrafegoReviewFixes();
  const fixes = readOrderReviewFixes(order.reviewFixes);
  const fixItems = fixes ? describeReviewFixes(fixes) : [];
  const isOneTapApproval = canApproveByApplyingFixes({ fixes, notes: order.reviewNotes });
  const canApprove = permission?.canApprove === true;

  function handleApply() {
    applyFixes.mutate(
      { orderId: order.id },
      {
        onSuccess: (result) => {
          toast.success(
            result.isApproved
              ? `Melhorias aplicadas. A equipe publica em até ${REVIEW_SLA_HOURS} horas.`
              : "Melhorias aplicadas. Resolva os outros pontos e o anúncio volta para a avaliação.",
          );
          setIsOpen(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="rounded-[20px] border border-warning/40 bg-warning/[0.06] p-4">
      <PendingApprovalBadge />
      <p className="mt-3 text-sm font-semibold">A equipe pediu ajustes antes de publicar</p>
      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{recommendation.detail}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {canApprove ? (
          <Button className="h-10 rounded-full" onClick={() => setIsOpen(true)} data-guide={GUIDE_ANCHORS.trafegoReviewFixes.id}>
            <Sparkles className="size-4" />
            Avaliar melhorias e aprovar
          </Button>
        ) : permission ? (
          <p className="self-center text-xs text-muted-foreground">Só o dono ou um admin da empresa pode aprovar.</p>
        ) : null}
        <Button variant="outline" className="h-10 rounded-full" onClick={onReply}>
          <MessageSquare className="size-4" />
          Responder
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Melhorias pedidas pela equipe</DialogTitle>
            <DialogDescription>Veja o que muda no seu anúncio antes de aprovar.</DialogDescription>
          </DialogHeader>
          {fixItems.length > 0 && (
            <section className="space-y-1.5">
              <p className="text-sm font-medium">Aplicamos para você</p>
              <ul className="space-y-1 text-sm">
                {fixItems.map((item) => (
                  <li key={item} className="rounded-[10px] bg-muted/60 px-2.5 py-1.5">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {order.reviewNotes.length > 0 && (
            <section className="space-y-1.5">
              <p className="text-sm font-medium">Você resolve no pedido</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {order.reviewNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Depois de ajustar, o anúncio volta para a avaliação da equipe.</p>
            </section>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Fechar
            </Button>
            {fixItems.length > 0 && (
              <Button onClick={handleApply} disabled={applyFixes.isPending}>
                {applyFixes.isPending ? "Aplicando…" : isOneTapApproval ? "Aplicar e aprovar" : "Aplicar melhorias"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
