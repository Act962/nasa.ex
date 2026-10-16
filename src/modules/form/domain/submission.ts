/** O que o envio de uma resposta decide sem tocar em banco nem em rede. */

export const UNNAMED_LEAD_NAME = "Sem nome";

export type LeadIdentity = {
  name: string;
  email: string | null;
  phone: string | null;
};

/**
 * Nome, e-mail e telefone que a pessoa informou nos campos de identificação.
 * Resposta que não é JSON é aceita de propósito: vira identidade vazia e o
 * envio segue.
 */
export function readLeadIdentity(responseJson: string): LeadIdentity {
  let answers: Record<string, string> = {};
  try {
    answers = JSON.parse(responseJson) ?? {};
  } catch {}

  return {
    name: answers.user_name || UNNAMED_LEAD_NAME,
    email: answers.user_email || null,
    phone: answers.user_phone || null,
  };
}

/**
 * Identidade lida pelo salvamento parcial. Difere de `readLeadIdentity`: aceita
 * só texto e mantém o texto vazio como veio (nome "" não vira "Sem nome").
 * A diferença vem do código de origem e foi preservada na migração.
 */
export function readDraftLeadIdentity(responseJson: string): LeadIdentity {
  let answers: Record<string, unknown> = {};
  try {
    answers = JSON.parse(responseJson) ?? {};
  } catch {}

  const readText = (fieldName: string) =>
    typeof answers[fieldName] === "string" ? (answers[fieldName] as string) : null;

  return {
    name: readText("user_name") ?? UNNAMED_LEAD_NAME,
    email: readText("user_email"),
    phone: readText("user_phone"),
  };
}

export type ResponseMilestoneAction = "form_10_responses" | "form_100_responses";

/** Marcos que pontuam o dono do formulário: a 10ª e a 100ª resposta. */
export function responseMilestoneAction(responseCount: number): ResponseMilestoneAction | null {
  if (responseCount === 10) return "form_10_responses";
  if (responseCount === 100) return "form_100_responses";
  return null;
}

export type LeadContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  publicToken: string | null;
};

export type BoardPosition = { trackingId: string; statusId: string };

export type LeadPlacementOutcome = "created" | "moved" | "relocated" | "reused";

/** Onde o lead ficou depois de ser posicionado no tracking e coluna do formulário. */
export type LeadPlacement = {
  lead: LeadContact & { responsibleId: string | null };
  outcome: LeadPlacementOutcome;
  from: BoardPosition | null;
  to: BoardPosition;
};

/** Só mover de coluna ou trocar de tracking muda o board; criar e reaproveitar não. */
export function didLeadChangePosition(placement: LeadPlacement): boolean {
  return placement.outcome === "moved" || placement.outcome === "relocated";
}
