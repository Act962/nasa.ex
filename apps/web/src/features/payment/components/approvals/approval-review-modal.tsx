"use client";

/**
 * Modal de revisão de PaymentApprovalRequest. Exibe detalhes da entry,
 * requester e contato; permite Aprovar (motivo opcional) ou Rejeitar
 * (motivo obrigatório, min 1 char).
 *
 * Side-effects são responsabilidade dos hooks `useApprovePaymentRequest` /
 * `useRejectPaymentRequest` — invalidation default + toast aqui.
 */

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  useApprovePaymentRequest,
  useRejectPaymentRequest,
} from "../../hooks/use-payment-approvals";

interface ApprovalReviewRequest {
  id: string;
  requestedBy: { name: string; email: string };
  entry: {
    description: string;
    amount: number;
    type: string;
    dueDate: Date | string;
    contact: { name: string } | null;
    category: { name: string; color: string | null } | null;
  };
}

interface Props {
  request: ApprovalReviewRequest | null;
  onClose: () => void;
}

export function ApprovalReviewModal({ request, onClose }: Props) {
  const approveMut = useApprovePaymentRequest();
  const rejectMut = useRejectPaymentRequest();
  const [reason, setReason] = useState("");

  function handleClose() {
    setReason("");
    onClose();
  }

  function handleApprove() {
    if (!request) return;
    approveMut.mutate(
      { requestId: request.id, reason: reason || undefined },
      {
        onSuccess: () => {
          toast.success(`Pagamento "${request.entry.description}" aprovado`);
          handleClose();
        },
        onError: (err) => {
          toast.error(err.message || "Erro ao aprovar");
        },
      },
    );
  }

  function handleReject() {
    if (!request) return;
    if (reason.trim().length === 0) {
      toast.error("Informe o motivo da rejeição");
      return;
    }
    rejectMut.mutate(
      { requestId: request.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(`Pagamento "${request.entry.description}" rejeitado`);
          handleClose();
        },
        onError: (err) => {
          toast.error(err.message || "Erro ao rejeitar");
        },
      },
    );
  }

  const submitting = approveMut.isPending || rejectMut.isPending;

  if (!request) return null;

  const valor = (request.entry.amount / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const dueLabel = new Date(request.entry.dueDate).toLocaleDateString("pt-BR");

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revisar pagamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <p className="font-medium">{request.entry.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Valor</Label>
              <p className="font-semibold text-base">{valor}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Vencimento</Label>
              <p>{dueLabel}</p>
            </div>
          </div>

          {request.entry.contact && (
            <div>
              <Label className="text-xs text-muted-foreground">
                {request.entry.type === "PAYABLE" ? "Fornecedor" : "Cliente"}
              </Label>
              <p>{request.entry.contact.name}</p>
            </div>
          )}

          {request.entry.category && (
            <div>
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <div className="mt-0.5">
                <Badge
                  variant="outline"
                  style={
                    request.entry.category.color
                      ? {
                          borderColor: request.entry.category.color,
                          color: request.entry.category.color,
                        }
                      : undefined
                  }
                >
                  {request.entry.category.name}
                </Badge>
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">Solicitado por</Label>
            <p>{request.requestedBy.name} · {request.requestedBy.email}</p>
          </div>

          <div>
            <Label htmlFor="reason" className="text-xs">
              Motivo <span className="text-muted-foreground">(obrigatório na rejeição)</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: OK pagar / cliente confirmou desconto / valor incorreto"
              rows={3}
              className="mt-1"
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={submitting}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {rejectMut.isPending ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <XCircle className="size-4 mr-2" />
            )}
            Rejeitar
          </Button>
          <Button
            onClick={handleApprove}
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {approveMut.isPending ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="size-4 mr-2" />
            )}
            Aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
