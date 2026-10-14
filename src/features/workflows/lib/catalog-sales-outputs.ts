// Saídas das ações da venda guiada (spec 0104), com rótulo para o testador passo a passo.
export const CATALOG_SALES_OUTPUT_LABELS: Record<string, Array<{ id: string; label: string }>> = {
  SALES_APPROVAL: [
    { id: "approved", label: "Aprovado" },
    { id: "rejected", label: "Recusado / ajuste" },
    { id: "timeout", label: "Sem resposta" },
  ],
  CHECK_CREDIT: [
    { id: "eligible", label: "Apto a comprar" },
    { id: "overdue", label: "Inadimplente" },
  ],
  FIND_CUSTOMER_BY_DOCUMENT: [
    { id: "returning", label: "Cliente recorrente" },
    { id: "new", label: "Cliente novo" },
    { id: "no_document", label: "Sem documento" },
  ],
  ROUTE_TO_CONSULTANT: [
    { id: "found", label: "Achou o consultor" },
    { id: "not_found", label: "Não achou" },
  ],
  CATALOG_ORDER_ACTION: [
    { id: "main", label: "Pedido atualizado" },
    { id: "no_order", label: "Sem pedido" },
  ],
};
