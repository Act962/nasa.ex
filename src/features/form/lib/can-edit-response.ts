import prisma from "@/lib/prisma";
import {
  canEditFormResponse,
  resolveEditPolicy,
  type EditBlockedReason,
  type EditVerdict,
  type EditableResponse,
  type ResponseEditContext,
  type ResponseEditPolicy,
} from "@/modules/form/domain/response-edit-policy";
import { NOT_TRACKING_PARTICIPANT_MESSAGE } from "@/features/leads/lib/tracking-participant-guard";

/**
 * Guard único de edição de respostas de formulário (spec 0005).
 *
 * Dividido em duas partes de propósito (D-8): `resolveResponseEditContext` faz
 * o I/O uma vez por request e `canEditFormResponse` decide por linha sem tocar
 * no banco. Sem essa separação, exibir cadeado numa tela de lista viraria N+1.
 */

export const EDIT_BLOCKED_MESSAGE: Record<EditBlockedReason, string> = {
  not_org_member: "Você não tem acesso a esta resposta",
  not_tracking_participant: NOT_TRACKING_PARTICIPANT_MESSAGE,
  not_author:
    "Somente quem preencheu esta resposta pode editá-la. Fale com um gestor se precisar alterar.",
  unattributed_response:
    "Esta resposta não tem registro de quem a preencheu, então só um gestor pode editá-la.",
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

/**
 * Atalho para o caminho de UMA resposta (procedures de escrita). Carrega o
 * contexto e aplica o predicado numa tacada.
 */
export async function checkFormResponseEditable(
  response: EditableResponse,
  policy: ResponseEditPolicy,
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

export { canEditFormResponse, resolveEditPolicy };
export type { EditBlockedReason, EditVerdict, EditableResponse, ResponseEditContext };
