"use client";

import { SendQuoteForm, type QuoteFormItem } from "@/features/nerp-catalog/components/send-quote-form";
import { OrderApprovalsPanel } from "@/features/nerp-catalog/components/order-approvals-panel";
import { ConfirmPaymentCard } from "@/features/nerp-catalog/components/confirm-payment-card";

export type PendingCatalogOrder = {
  id: string;
  saleNumber: number;
  shipping: number;
  discount: number;
  items: QuoteFormItem[];
  isTeamApproval: boolean;
  total: number;
  isPaid: boolean;
  /** Um setor mudou o prazo depois do pagamento e o cliente ainda não aceitou. */
  isAwaitingDeliveryChange: boolean;
  canSendQuote: boolean;
  /** Cliente aprovou o valor e o pagamento chega por fora (loja sem Asaas). */
  canConfirmPayment: boolean;
};

interface CatalogOrderQuoteViewProps {
  order: PendingCatalogOrder;
  onSent: () => void;
}

function describeOrderStep(order: PendingCatalogOrder): string {
  if (order.canSendQuote || order.canConfirmPayment) {
    return "Os preços vêm da tabela do NERP (unidade e caixa). Ajuste o valor que vai ofertar; o cliente aprova no WhatsApp e o Astro gera o PIX ou o link.";
  }
  if (!order.isPaid) return "Aguardando a aprovação dos setores abaixo.";
  if (order.isAwaitingDeliveryChange) return "Pagamento recebido. Aguardando o cliente aceitar o novo prazo de entrega.";
  return "Pagamento recebido. Falta a conferência dos setores abaixo para o cliente receber o acompanhamento com o prazo.";
}

// Spec 0103, RF-12: o valor do pedido do catálogo negociado sem sair da conversa.
export function CatalogOrderQuoteView({ order, onSent }: CatalogOrderQuoteViewProps) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div>
        <p className="text-sm font-semibold">Pedido #{order.saleNumber} — Catálogo online</p>
        <p className="text-xs text-muted-foreground">
          {describeOrderStep(order)}
        </p>
      </div>
      {order.canConfirmPayment ? (
        <ConfirmPaymentCard orderId={order.id} saleNumber={order.saleNumber} total={order.total} onConfirmed={onSent} />
      ) : order.canSendQuote ? (
        <SendQuoteForm
          key={order.id}
          orderId={order.id}
          items={order.items}
          shipping={order.shipping}
          discount={order.discount}
          isTeamApproval={order.isTeamApproval}
          onSent={onSent}
        />
      ) : null}
      <OrderApprovalsPanel orderId={order.id} />
    </div>
  );
}
