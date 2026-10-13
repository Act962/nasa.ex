/**
 * Quem pode editar uma resposta de formulário (spec 0005). Só a decisão: os
 * fatos do usuário chegam prontos em `ResponseEditContext`, carregados uma vez
 * por request por quem chama.
 */

export type ResponseAuthorKind = "USER" | "LEAD" | "SYSTEM" | "UNKNOWN";

export type ResponseEditPolicy = "TRACKING_PARTICIPANTS" | "AUTHOR_ONLY";

export type EditBlockedReason =
  | "not_org_member"
  | "not_tracking_participant"
  | "not_author"
  | "unattributed_response";

export type ResponseEditContext = {
  userId: string;
  isOrgMember: boolean;
  /** `Member.role === "owner"` — o "Master" da conta. */
  isMaster: boolean;
  /** Trackings em que o usuário é `TrackingParticipant.role = "OWNER"`. */
  ownedTrackingIds: Set<string>;
  /** Todos os trackings da org em que o usuário participa, em qualquer papel. */
  participantTrackingIds: Set<string>;
};

export type EditableResponse = {
  authorKind: ResponseAuthorKind;
  createdById: string | null;
  /** Tracking ATUAL do lead. `null` = resposta sem lead vinculado. */
  leadTrackingId: string | null;
};

export type EditVerdict = {
  canEdit: boolean;
  reason: EditBlockedReason | null;
};

/**
 * Decide se o usuário pode editar UMA resposta. Função pura — sem I/O, sem
 * mock, sem servidor. É onde mora a matriz 6.2 e a invariante 6.3 da spec.
 */
export function canEditFormResponse(
  response: EditableResponse,
  policy: ResponseEditPolicy,
  context: ResponseEditContext,
): EditVerdict {
  if (!context.isOrgMember) {
    return { canEdit: false, reason: "not_org_member" };
  }

  // Invariante 6.3 — gestores editam em qualquer nível, e dispensam o guard de
  // setor (D-4). Sem isso, a mensagem "fale com um gestor" não teria destino:
  // o gestor que não participa do tracking também ficaria de fora.
  const isTrackingOwner =
    !!response.leadTrackingId &&
    context.ownedTrackingIds.has(response.leadTrackingId);
  if (context.isMaster || isTrackingOwner) {
    return { canEdit: true, reason: null };
  }

  // Regra de setor pré-existente — teto de qualquer política (D-15). Respostas
  // sem lead já pulavam essa checagem antes da spec; mantido.
  if (
    response.leadTrackingId &&
    !context.participantTrackingIds.has(response.leadTrackingId)
  ) {
    return { canEdit: false, reason: "not_tracking_participant" };
  }

  if (policy === "TRACKING_PARTICIPANTS") {
    return { canEdit: true, reason: null };
  }

  // AUTHOR_ONLY — a origem da resposta só importa aqui (D-10).
  switch (response.authorKind) {
    case "USER":
      return response.createdById && response.createdById === context.userId
        ? { canEdit: true, reason: null }
        : { canEdit: false, reason: "not_author" };
    case "LEAD":
      // Preenchida pelo próprio lead: não há autor-usuário a honrar. Cai para
      // participante, preservando o "Continuar preenchimento" (CB-2).
      return { canEdit: true, reason: null };
    case "SYSTEM":
      // Criada em branco por automação: ninguém preencheu ainda, então não há
      // autoria a proteger. Cai para participante — quem do setor pegar a
      // tarefa preenche (CB-18).
      return { canEdit: true, reason: null };
    case "UNKNOWN":
      // Legado sem atribuição: a política exige autoria e o dado não tem (CB-3).
      return { canEdit: false, reason: "unattributed_response" };
  }
}

/**
 * Política efetiva de um formulário. `FormSettings` é opcional na relação —
 * formulário sem settings resolve para o padrão (RNF-5).
 */
export function resolveEditPolicy(
  settings: { responseEditPolicy: ResponseEditPolicy } | null | undefined,
): ResponseEditPolicy {
  return settings?.responseEditPolicy ?? "TRACKING_PARTICIPANTS";
}
