// Quais pedidos do catálogo pedem ação da equipe na aba "Pedido" do chat.

type OpenApprovalsInput = {
  status: string;
  pendingApprovalCount: number;
  pendingDeliveryChangeAt: Date | null;
  postPaymentApprovedAt: Date | null;
};

export function isAwaitingDeliveryChange(order: Omit<OpenApprovalsInput, "pendingApprovalCount">): boolean {
  return order.status !== "CANCELED" && !!order.pendingDeliveryChangeAt && !order.postPaymentApprovedAt;
}

/** Setor ainda vai decidir, ou um setor mudou o prazo e o cliente ainda não aceitou. Pedido cancelado não conta. */
export function hasOpenTeamApprovals(order: OpenApprovalsInput): boolean {
  if (order.status === "CANCELED") return false;
  return order.pendingApprovalCount > 0 || isAwaitingDeliveryChange(order);
}

type ChatOrderActions = { canSendQuote: boolean; canConfirmPayment: boolean; hasOpenApprovals: boolean };

export function needsTeamAction(order: ChatOrderActions): boolean {
  return order.canSendQuote || order.canConfirmPayment || order.hasOpenApprovals;
}

/** Todos os pedidos com ação pendente, na ordem recebida: um pedido novo não esconde a conferência de um anterior. */
export function pickChatCatalogOrders<Order extends ChatOrderActions>(orders: Order[]): Order[] {
  return orders.filter(needsTeamAction);
}
