"use client";

/**
 * Card de 1 PaymentApprovalRequest pendente — usado dentro do `ApprovalsTab`.
 * Mostra os dados essenciais pra decisão rápida: requester, descrição, valor,
 * contato, categoria, vencimento, há quanto tempo. Click → abre o
 * `ApprovalReviewModal` pra Aprovar/Rejeitar com motivo.
 */

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, ArrowRight } from "lucide-react";

interface Props {
  request: {
    id: string;
    requestedAt: Date | string;
    requestedBy: {
      name: string;
      email: string;
      image: string | null;
    };
    entry: {
      description: string;
      amount: number; // centavos
      type: string;
      dueDate: Date | string;
      contact: { name: string } | null;
      category: { name: string; color: string | null } | null;
    };
  };
  onReview: (requestId: string) => void;
}

export function ApprovalRequestCard({ request, onReview }: Props) {
  const valor = (request.entry.amount / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const requestedAgo = formatDistanceToNow(new Date(request.requestedAt), {
    addSuffix: true,
    locale: ptBR,
  });
  const dueLabel = new Date(request.entry.dueDate).toLocaleDateString("pt-BR");
  const requesterInitials = request.requestedBy.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Card
      className="p-4 hover:border-primary/50 transition-colors cursor-pointer flex items-center gap-4"
      onClick={() => onReview(request.id)}
    >
      <Avatar className="h-10 w-10">
        {request.requestedBy.image && (
          <AvatarImage src={request.requestedBy.image} />
        )}
        <AvatarFallback>{requesterInitials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium truncate">
            {request.entry.description}
          </span>
          {request.entry.category && (
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5"
              style={
                request.entry.category.color
                  ? { borderColor: request.entry.category.color, color: request.entry.category.color }
                  : undefined
              }
            >
              {request.entry.category.name}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-foreground">{valor}</span>
          {request.entry.contact && (
            <span>· {request.entry.contact.name}</span>
          )}
          <span>· vence {dueLabel}</span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" /> solicitado {requestedAgo}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          por <strong>{request.requestedBy.name}</strong>
        </div>
      </div>

      <ArrowRight className="size-4 text-muted-foreground" />
    </Card>
  );
}
