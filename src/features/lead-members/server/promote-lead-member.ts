import "server-only";
import { Decimal } from "@prisma/client/runtime/client";
import { LeadAction } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { trackLeadEvent } from "@/lib/lead-journey/track";

/**
 * Promove um vinculado a lead (spec 0076, RF-10). Função própria: não toca em
 * `leads.create`, mas grava o mesmo que a criação manual grava — telefone
 * único no tracking, fim da coluna, histórico, jornada, atividade e Stars. O
 * CA-12 compara os dois leads coluna a coluna para os caminhos não divergirem.
 *
 * Tracking, etapa e responsável são sempre os do titular.
 */

export class LeadMemberActionError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "BAD_REQUEST",
    message: string,
  ) {
    super(message);
  }
}

interface ActingUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export async function promoteLeadMember(params: { memberId: string; organizationId: string; actor: ActingUser }): Promise<{ leadId: string }> {
  const member = await prisma.leadMember.findFirst({
    where: { id: params.memberId, organizationId: params.organizationId, lead: { tracking: { organizationId: params.organizationId } } },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      document: true,
      notes: true,
      parentMemberId: true,
      promotedLeadId: true,
      lead: { select: { id: true, name: true, trackingId: true, statusId: true, responsibleId: true, tracking: { select: { name: true } } } },
    },
  });
  if (!member) throw new LeadMemberActionError("NOT_FOUND", "Vinculado não encontrado");
  if (member.promotedLeadId) throw new LeadMemberActionError("BAD_REQUEST", "Este vinculado já virou lead.");
  const phone = member.phone?.trim();
  if (!phone) throw new LeadMemberActionError("BAD_REQUEST", "Para virar lead o vinculado precisa de telefone. Edite o cadastro dele e tente de novo.");

  const titular = member.lead;
  const responsibleId = titular.responsibleId ?? params.actor.id;

  const promotedLead = await prisma.$transaction(async (tx) => {
    const samePhoneLead = await tx.lead.findUnique({
      where: { phone_trackingId: { phone, trackingId: titular.trackingId } },
      select: { name: true },
    });
    if (samePhoneLead) {
      throw new LeadMemberActionError("BAD_REQUEST", `Já existe um lead com este telefone neste tracking (${samePhoneLead.name}).`);
    }

    const lastLeadOfStatus = await tx.lead.findFirst({
      where: { statusId: titular.statusId, trackingId: titular.trackingId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const newLead = await tx.lead.create({
      data: {
        name: member.name,
        phone,
        email: member.email ?? undefined,
        document: member.document ?? undefined,
        description: member.notes ?? undefined,
        statusId: titular.statusId,
        trackingId: titular.trackingId,
        order: lastLeadOfStatus ? new Decimal(lastLeadOfStatus.order).plus(1) : new Decimal(0),
        responsibleId,
        assignedAt: new Date(),
        originLeadId: titular.id,
      },
      select: { id: true, name: true },
    });
    await tx.leadHistory.create({
      data: { leadId: newLead.id, userId: params.actor.id, action: LeadAction.ACTIVE, notes: `Lead criado a partir de ${member.name}, vinculado de ${titular.name}` },
    });

    await tx.leadMember.update({ where: { id: member.id }, data: { promotedLeadId: newLead.id, promotedAt: new Date() } });
    // Quem estava abaixo dele sobe um nível: continua vinculado do titular.
    await tx.leadMember.updateMany({ where: { parentMemberId: member.id }, data: { parentMemberId: member.parentMemberId } });

    // As fichas abertas acompanham o lead novo; as de período fechado ficam, porque documento fechado não muda.
    const closedRecords = await tx.formRecord.findMany({
      where: { leadMemberId: member.id, closingId: { not: null } },
      select: { responseId: true },
    });
    const closedResponseIds = closedRecords.map((record) => record.responseId);
    await tx.formRecord.updateMany({
      where: { leadMemberId: member.id, closingId: null },
      data: { leadId: newLead.id, leadMemberId: null },
    });
    await tx.formResponses.updateMany({
      where: { leadMemberId: member.id, id: { notIn: closedResponseIds } },
      data: { leadId: newLead.id, leadMemberId: null },
    });
    return newLead;
  });

  // Efeitos depois do commit (regra 18): falha aqui não desfaz a promoção.
  try {
    await trackLeadEvent({
      leadId: promotedLead.id,
      kind: "lead_assigned",
      actorId: params.actor.id,
      metadata: { responsibleId, source: "lead_member_promotion", originLeadId: titular.id },
    });
    await logActivity({
      organizationId: params.organizationId,
      userId: params.actor.id,
      userName: params.actor.name,
      userEmail: params.actor.email,
      userImage: params.actor.image ?? undefined,
      appSlug: "tracking",
      subAppSlug: "tracking-pipeline",
      featureKey: "lead.created",
      action: "lead_create",
      actionLabel: `Criou o lead "${promotedLead.name}"`,
      resource: promotedLead.name,
      resourceId: promotedLead.id,
      metadata: { phone, trackingName: titular.tracking.name, originLeadId: titular.id },
    });
    await chargeStarsByAction(params.organizationId, "lead_create", {
      userId: params.actor.id,
      description: `Criou lead "${promotedLead.name}"`,
      appSlug: "tracking",
    });
  } catch (error) {
    console.error("[lead-members/promote] efeito pós-criação falhou", { leadId: promotedLead.id, error });
  }

  return { leadId: promotedLead.id };
}
