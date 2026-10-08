import "server-only";
import { LeadAction } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { LeadMemberActionError } from "./promote-lead-member";

/**
 * Junta um lead como vinculado de outro (spec 0076, RF-11) — o caminho de
 * filiais que hoje são leads separados. O lead de origem é arquivado, não
 * apagado: conversas, arquivos e histórico dele continuam acessíveis.
 */
export async function mergeLeadIntoMember(params: {
  organizationId: string;
  sourceLeadId: string;
  titularLeadId: string;
  actorId: string;
}): Promise<{ memberId: string }> {
  if (params.sourceLeadId === params.titularLeadId) {
    throw new LeadMemberActionError("BAD_REQUEST", "Um lead não pode ser vinculado dele mesmo.");
  }
  const leadSelect = { id: true, name: true, phone: true, email: true, document: true, description: true, originLeadId: true } as const;
  const [sourceLead, titularLead] = await Promise.all([
    prisma.lead.findFirst({ where: { id: params.sourceLeadId, tracking: { organizationId: params.organizationId } }, select: leadSelect }),
    prisma.lead.findFirst({ where: { id: params.titularLeadId, tracking: { organizationId: params.organizationId } }, select: leadSelect }),
  ]);
  if (!sourceLead || !titularLead) throw new LeadMemberActionError("NOT_FOUND", "Lead não encontrado");

  const [billedClosedLines, paymentEntryCount, conversation, titularIsMemberOfSource] = await Promise.all([
    prisma.formClosingLine.count({ where: { leadId: sourceLead.id, paymentEntryId: { not: null }, closing: { status: "CLOSED" } } }),
    prisma.paymentEntry.count({ where: { leadId: sourceLead.id } }),
    prisma.conversation.findFirst({ where: { leadId: sourceLead.id }, select: { id: true } }),
    prisma.leadMember.count({ where: { leadId: sourceLead.id, promotedLeadId: titularLead.id } }),
  ]);
  if (billedClosedLines > 0 || paymentEntryCount > 0) {
    throw new LeadMemberActionError("BAD_REQUEST", `${sourceLead.name} já tem conta no Financeiro. As contas ficariam em nome de um lead arquivado; resolva-as antes de juntar.`);
  }
  if (conversation) {
    throw new LeadMemberActionError("BAD_REQUEST", `${sourceLead.name} tem conversa no Chat. Vinculado não tem conversa própria; mantenha-o como lead.`);
  }
  if (titularIsMemberOfSource > 0) {
    throw new LeadMemberActionError("BAD_REQUEST", "O titular escolhido nasceu deste lead; juntar os dois fecharia um ciclo.");
  }

  const member = await prisma.$transaction(async (tx) => {
    const createdMember = await tx.leadMember.create({
      data: {
        organizationId: params.organizationId,
        leadId: titularLead.id,
        name: sourceLead.name,
        phone: sourceLead.phone,
        email: sourceLead.email,
        document: sourceLead.document,
        notes: sourceLead.description,
      },
      select: { id: true },
    });
    // Os vinculados que o lead já tinha passam para o titular, abaixo do novo vinculado.
    await tx.leadMember.updateMany({ where: { leadId: sourceLead.id, parentMemberId: null }, data: { parentMemberId: createdMember.id } });
    await tx.leadMember.updateMany({ where: { leadId: sourceLead.id }, data: { leadId: titularLead.id } });

    // Fichas do próprio lead vão para o vinculado novo; as que já eram de um vinculado dele só trocam de titular.
    const closedRecords = await tx.formRecord.findMany({ where: { leadId: sourceLead.id, closingId: { not: null } }, select: { responseId: true } });
    const closedResponseIds = closedRecords.map((record) => record.responseId);
    await tx.formRecord.updateMany({ where: { leadId: sourceLead.id, closingId: null, leadMemberId: null }, data: { leadId: titularLead.id, leadMemberId: createdMember.id } });
    await tx.formRecord.updateMany({ where: { leadId: sourceLead.id, closingId: null }, data: { leadId: titularLead.id } });
    await tx.formResponses.updateMany({ where: { leadId: sourceLead.id, leadMemberId: null, id: { notIn: closedResponseIds } }, data: { leadId: titularLead.id, leadMemberId: createdMember.id } });
    await tx.formResponses.updateMany({ where: { leadId: sourceLead.id, id: { notIn: closedResponseIds } }, data: { leadId: titularLead.id } });

    await tx.lead.update({ where: { id: sourceLead.id }, data: { isArchived: true, archivedAt: new Date() } });
    await tx.leadHistory.create({
      data: { leadId: sourceLead.id, userId: params.actorId, action: LeadAction.ACTIVE, notes: `Virou vinculado de ${titularLead.name} e foi arquivado` },
    });
    await tx.leadHistory.create({
      data: { leadId: titularLead.id, userId: params.actorId, action: LeadAction.ACTIVE, notes: `${sourceLead.name} passou a ser vinculado deste lead` },
    });
    return createdMember;
  });

  return { memberId: member.id };
}
