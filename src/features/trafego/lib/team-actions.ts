// O que a equipe precisa fazer em cada pedido (spec 0131, RF-4). Puro: roda no QA e no MCP.

import type { TrafegoOrderStatus } from "@/generated/prisma/enums";
import { isOrderBeforeLaunch } from "./order-status";

const DAY_MS = 24 * 60 * 60 * 1000;
const IDLE_DAYS_WARNING = 3;

export interface TeamActionInput {
  status: TrafegoOrderStatus;
  hasCreative: boolean;
  hasCopy: boolean;
  hasLinkedCampaign: boolean;
  /** Recomendação enviada e ainda sem resposta do cliente. */
  hasPendingApproval: boolean;
  /** Última recomendação aprovada depois do último vínculo de campanha. */
  hasApprovalToPublish: boolean;
  /** Pedido esperando a avaliação do Claude (spec 0132). */
  hasPendingCampaignReview?: boolean;
  /** Aprovado e liberado pelo cliente, no dia de começar (spec 0132). */
  isReadyToPublish?: boolean;
  lastActivityAt: Date;
  now?: Date;
}

export interface TeamActions {
  /** Ações da equipe, da mais urgente para a menos. */
  actions: string[];
  /** Situação que não depende da equipe (esperando o cliente). */
  waitingOn: string | null;
  idleDays: number;
}

/** Aceita "TG-0042", "tg-0042", "0042" e "42"; outros códigos passam em maiúsculas. */
export function normalizeOrderCode(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (/^\d{1,6}$/.test(trimmed)) return `TG-${trimmed.padStart(4, "0")}`;
  return trimmed;
}

export function describeTeamActions(input: TeamActionInput): TeamActions {
  const now = (input.now ?? new Date()).getTime();
  const idleDays = Math.max(0, Math.floor((now - input.lastActivityAt.getTime()) / DAY_MS));
  const actions: string[] = [];
  const beforeLaunch = isOrderBeforeLaunch(input.status);

  if (input.hasPendingCampaignReview) actions.push("Esperando avaliação: use trafego_list_review_queue");
  if (input.isReadyToPublish) actions.push("Cliente liberou: publicar pela Meta e chamar trafego_mark_published");
  if (input.hasApprovalToPublish) actions.push("Cliente aprovou a recomendação: seguir com a publicação");
  if (beforeLaunch && (!input.hasCreative || !input.hasCopy)) {
    actions.push(`Falta ${!input.hasCreative && !input.hasCopy ? "criativo e texto" : !input.hasCreative ? "criativo" : "texto"} do cliente`);
  }
  if (beforeLaunch && input.hasCreative && input.hasCopy && !input.hasLinkedCampaign && !input.hasPendingApproval) {
    actions.push("Montar a campanha na Meta");
  }
  if (input.status === "CHANGES_REQUESTED") actions.push("Conferir a correção pedida ao cliente");
  if (actions.length > 0 && idleDays >= IDLE_DAYS_WARNING) actions.push(`Parado há ${idleDays} dias`);

  return {
    actions,
    waitingOn: input.hasPendingApproval ? "Esperando o cliente aprovar a recomendação" : null,
    idleDays,
  };
}
