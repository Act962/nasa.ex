export const CONTRACT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDENTE_ASSINATURA: { label: "Pendente Assinatura", color: "bg-warning/15 text-warning border-warning/30" },
  ATIVO:               { label: "Ativo",               color: "bg-success/15 text-success border-success/30" },
  ENCERRADO:           { label: "Encerrado",           color: "bg-muted text-muted-foreground border-line" },
  CANCELADO:           { label: "Cancelado",           color: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function getContractStatus(status: string) {
  return CONTRACT_STATUS_CONFIG[status] ?? { label: status, color: "bg-muted text-muted-foreground border-line" };
}

export function formatContractNumber(contractNumber: number) {
  return `#${String(contractNumber).padStart(4, "0")}`;
}

export function formatCurrency(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
