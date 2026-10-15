// Spec 0106 (RF-5): tags que a carteira do ERP põe no lead. Todas no grupo "Carteira ERP".
import type { ErpCustomer } from "@/http/nerp/erp-carteira";

export const ERP_TAG_GROUP_NAME = "Carteira ERP";
export const ERP_PURCHASE_EVENT = "erp_purchase";
export const ERP_CUSTOMER_SINCE_EVENT = "erp_customer_since";

const DAY_MS = 24 * 60 * 60 * 1000;
const INACTIVE_LONG_DAYS = 180;
const INACTIVE_SHORT_DAYS = 90;

export type ErpTagSpec = { name: string; color: string; description: string };

/** "LATICINIOS E FRIOS" → "Laticinios E Frios": o Winthor guarda tudo em maiúsculas. */
function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function buildCustomerTags(customer: ErpCustomer, now: Date): ErpTagSpec[] {
  const tags: ErpTagSpec[] = [
    { name: "Winthor", color: "#64748b", description: "Cliente da carteira do ERP (Winthor)." },
  ];
  if (customer.filial) {
    tags.push({
      name: `Filial ${toTitleCase(customer.filial.nome)}`,
      color: "#0ea5e9",
      description: "Filial do cadastro do cliente no ERP.",
    });
  }
  tags.push(
    customer.divida
      ? { name: "Inadimplente", color: "#dc2626", description: "Tem parcela vencida e não paga no ERP." }
      : { name: "Em dia", color: "#16a34a", description: "Sem parcela vencida no ERP." },
  );
  const lastPurchaseAt = customer.ultimaCompra ? new Date(customer.ultimaCompra) : null;
  const daysWithoutPurchase = lastPurchaseAt
    ? Math.floor((now.getTime() - lastPurchaseAt.getTime()) / DAY_MS)
    : null;
  if (daysWithoutPurchase !== null && daysWithoutPurchase >= INACTIVE_LONG_DAYS) {
    tags.push({ name: "Inativo 180d", color: "#b45309", description: "Sem compra há 180 dias ou mais." });
  } else if (daysWithoutPurchase !== null && daysWithoutPurchase >= INACTIVE_SHORT_DAYS) {
    tags.push({ name: "Inativo 90d", color: "#d97706", description: "Sem compra há 90 dias ou mais." });
  }
  for (const interest of customer.interesses) {
    tags.push({
      name: `Interesse: ${toTitleCase(interest)}`,
      color: "#7c3aed",
      description: "Departamento entre os mais comprados nos últimos 12 meses.",
    });
  }
  return tags;
}
