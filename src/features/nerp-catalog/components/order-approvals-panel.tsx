"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { SALES_ROUND_LABEL, SALES_SECTOR_LABEL, type SalesApprovalState } from "../lib/approvals/approval-rules";
import { formatDeliveryDate } from "../lib/approvals/approval-messages";
import { useDecideOrderApproval, useOrderApprovals } from "../hooks/use-sales-approvals";

const STATUS_STYLE: Record<SalesApprovalState, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Aguardando", variant: "outline" },
  APPROVED: { label: "Aprovado", variant: "default" },
  REJECTED: { label: "Recusado", variant: "destructive" },
  ADJUSTED: { label: "Ajuste", variant: "secondary" },
  CANCELED: { label: "Cancelado", variant: "outline" },
};

// Spec 0104, RF-10: quem já decidiu, quem falta, e decisão pela tela para quem é aprovador do setor.
export function OrderApprovalsPanel({ orderId }: { orderId: string }) {
  const approvals = useOrderApprovals(orderId);
  const decide = useDecideOrderApproval();
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustDate, setAdjustDate] = useState("");

  if (!approvals.data || approvals.data.length === 0) return null;

  function handleDecision(approvalId: string, decision: "approve" | "reject" | "adjust") {
    decide.mutate(
      {
        approvalId,
        decision,
        note: decision === "adjust" ? adjustNote : undefined,
        proposedDeliveryAt: decision === "adjust" && adjustDate ? new Date(adjustDate).toISOString() : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Decisão registrada.");
          setAdjustingId(null);
          setAdjustNote("");
          setAdjustDate("");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3" data-guide={GUIDE_ANCHORS.orderApprovalsPanel.id}>
      <p className="text-sm font-semibold">Aprovação dos setores</p>
      <ul className="flex flex-col gap-2">
        {approvals.data.map((approval) => {
          const statusStyle = STATUS_STYLE[approval.status];
          return (
            <li key={approval.id} className="flex flex-col gap-1.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{SALES_SECTOR_LABEL[approval.sector]}</span>
                <span className="text-[11px] text-muted-foreground">{SALES_ROUND_LABEL[approval.round]}</span>
                <Badge variant={statusStyle.variant} className="ml-auto">
                  {statusStyle.label}
                </Badge>
              </div>
              {(approval.note || approval.proposedDeliveryAt) && (
                <p className="text-xs text-muted-foreground">
                  {approval.proposedDeliveryAt && `Entrega: ${formatDeliveryDate(new Date(approval.proposedDeliveryAt))}. `}
                  {approval.note}
                </p>
              )}
              {approval.canDecide && adjustingId !== approval.id && (
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => handleDecision(approval.id, "approve")} disabled={decide.isPending}>
                    Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDecision(approval.id, "reject")} disabled={decide.isPending}>
                    Recusar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAdjustingId(approval.id)}>
                    Ajustar
                  </Button>
                </div>
              )}
              {adjustingId === approval.id && (
                <div className="flex flex-col gap-1.5">
                  <Input placeholder="O que muda (ex.: entrega só sexta)" value={adjustNote} onChange={(event) => setAdjustNote(event.target.value)} />
                  <Input type="datetime-local" aria-label="Nova previsão de entrega" value={adjustDate} onChange={(event) => setAdjustDate(event.target.value)} />
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={() => handleDecision(approval.id, "adjust")} disabled={decide.isPending || (!adjustNote && !adjustDate)}>
                      Enviar ajuste
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAdjustingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
