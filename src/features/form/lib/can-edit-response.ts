import prisma from "@/lib/prisma";
import {
  FormResponseAuthorKind,
  FormResponseEditPolicy,
} from "@/generated/prisma/client";
import { NOT_TRACKING_PARTICIPANT_MESSAGE } from "@/features/leads/lib/tracking-participant-guard";

/**
 * Guard único de edição de respostas de formulário (spec 0005).
 *
 * Dividido em duas partes de propósito (D-8): `resolveResponseEditContext` faz
 * o I/O uma vez por request e `canEditFormResponse` decide por linha sem tocar
 * no banco. Sem essa separação, exibir cadeado numa tela de lista viraria N+1.
 */

export type EditBlockedReason =
  | "not_org_member"
  | "not_tracking_participant"
  | "not_author"
  | "unattributed_response";

export const EDIT_BLOCKED_MESSAGE: Record<EditBlockedReason, string> = {
  not_org_member: "Você não tem acesso a esta resposta",
  not_tracking_participant: NOT_TRACKING_PARTICIPANT_MESSAGE,
  not_author:
    "Somente quem preencheu esta resposta pode editá-la. Fale com um gestor se precisar alterar.",
  unattributed_response:
    "Esta resposta não tem registro de quem a preencheu, então só um gestor pode editá-la.",
};

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

/**
 * Resolve os fatos do USUÁRIO — os mesmos para todas as respostas do request.
 * Duas queries, em paralelo, independentemente de quantas respostas serão
 * avaliadas depois (RNF-4).
 */
export async function resolveResponseEditContext(
  userId: string,
  organizationId: string,
): Promise<ResponseEditContext> {
  const [member, participations] = await Promise.all([
    prisma.member.findFirst({
      where: { organizationId, userId },
      select: { role: true },
    }),
    prisma.trackingParticipant.findMany({
      where: { userId, tracking: { organizationId } },
      select: { trackingId: true, role: true },
    }),
  ]);

  const ownedTrackingIds = new Set<string>();
  const participantTrackingIds = new Set<string>();
  for (const participation of participations) {
    participantTrackingIds.add(participation.trackingId);
    if (participation.role === "OWNER") {
      ownedTrackingIds.add(participation.trackingId);
    }
  }

  return {
    userId,
    isOrgMember: !!member,
    isMaster: member?.role === "owner",
    ownedTrackingIds,
    participantTrackingIds,
  };
}

export type EditableResponse = {
  authorKind: FormResponseAuthorKind;
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
  policy: FormResponseEditPolicy,
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
 * Atalho para o caminho de UMA resposta (procedures de escrita). Carrega o
 * contexto e aplica o predicado numa tacada.
 */
export async function checkFormResponseEditable(
  response: EditableResponse,
  policy: FormResponseEditPolicy,
  userId: string,
  organizationId: string,
): Promise<EditVerdict> {
  const context = await resolveResponseEditContext(userId, organizationId);
  return canEditFormResponse(response, policy, context);
}

/**
 * Quem pode ALTERAR a política de um formulário (D-13): Master da org ou Owner
 * do tracking vinculado ao formulário. Sem este gate a política é decorativa —
 * quem for bloqueado por `AUTHOR_ONLY` afrouxaria o próprio bloqueio numa
 * chamada a `form.update`.
 *
 * Note que o tracking relevante aqui é o do FORMULÁRIO (`FormSettings.trackingId`),
 * não o do lead: a política é atributo do formulário.
 */
export async function isFormPolicyManager(params: {
  userId: string;
  organizationId: string;
  formTrackingId: string | null;
}): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { organizationId: params.organizationId, userId: params.userId },
    select: { role: true },
  });
  if (!member) return false;
  if (member.role === "owner") return true;
  if (!params.formTrackingId) return false;

  const participant = await prisma.trackingParticipant.findFirst({
    where: {
      trackingId: params.formTrackingId,
      userId: params.userId,
      role: "OWNER",
    },
    select: { id: true },
  });
  return !!participant;
}

/**
 * Política efetiva de um formulário. `FormSettings` é opcional na relação —
 * formulário sem settings resolve para o padrão (RNF-5).
 */
export function resolveEditPolicy(
  settings: { responseEditPolicy: FormResponseEditPolicy } | null | undefined,
): FormResponseEditPolicy {
  return settings?.responseEditPolicy ?? "TRACKING_PARTICIPANTS";
}
