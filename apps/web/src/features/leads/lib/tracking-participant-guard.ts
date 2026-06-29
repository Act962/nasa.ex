import prisma from "@/lib/prisma";

/**
 * Mensagem padronizada quando o user logado NÃO é participante do tracking
 * onde o lead se encontra atualmente. Ex: o consultor preencheu um form
 * quando o lead estava no tracking "Recepção" (do qual ele participava),
 * o lead foi movido pra "Orçamento" (do qual ele NÃO participa) e ele tenta
 * abrir/editar a resposta novamente.
 *
 * Usada em todas as procedures de form (getResponseById, updateResponse,
 * createResponseForLead) pra centralizar a regra: SÓ participantes do
 * tracking atual do lead podem mexer nos formulários do lead.
 */
export const NOT_TRACKING_PARTICIPANT_MESSAGE =
  "Este formulário não está mais no seu setor responsável, fale com um gestor para alterar e você poder editar";

/**
 * Verifica se o `userId` é um TrackingParticipant do tracking onde o lead
 * está atualmente. Devolve `{ ok, leadTrackingId }`. Se `ok=false`, o
 * caller deve lançar erro com `NOT_TRACKING_PARTICIPANT_MESSAGE`.
 */
export async function checkLeadTrackingParticipant(
  leadId: string,
  userId: string,
): Promise<{ ok: boolean; leadTrackingId: string | null }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { trackingId: true },
  });
  if (!lead) return { ok: false, leadTrackingId: null };

  const participant = await prisma.trackingParticipant.findFirst({
    where: { trackingId: lead.trackingId, userId },
    select: { id: true },
  });

  return { ok: !!participant, leadTrackingId: lead.trackingId };
}
