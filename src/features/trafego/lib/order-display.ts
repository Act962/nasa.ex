import type { TrafegoObjective } from "@/generated/prisma/enums";
import { OBJECTIVE_LABEL } from "./catalog-labels";

/**
 * Nome da campanha para o cliente (spec 0126): negócio + objetivo, ex.
 * "Clínica Tércio · Mensagens no WhatsApp". Sem negócio no pedido, só o objetivo:
 * o nome do plano antigo ("Plano Órbita") não diz nada ao cliente.
 */
export function buildOrderTitle(order: { businessName?: string | null; objective: TrafegoObjective }): string {
  const businessName = order.businessName?.trim();
  const objectiveLabel = OBJECTIVE_LABEL[order.objective];
  return businessName ? `${businessName} · ${objectiveLabel}` : objectiveLabel;
}
