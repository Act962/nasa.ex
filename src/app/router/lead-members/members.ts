import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { checkLeadTrackingParticipant } from "@/features/leads/lib/tracking-participant-guard";
import {
  MAX_MEMBER_DEPTH,
  depthUnderParent,
  resolveMemberLabels,
  subtreeHeight,
  wouldCreateCycle,
} from "@/features/lead-members/lib/member-tree";
import { mergeLeadIntoMember } from "@/features/lead-members/server/merge-lead-into-member";
import { LeadMemberActionError, promoteLeadMember } from "@/features/lead-members/server/promote-lead-member";

// Vinculados de um lead (spec 0076, fase 1): listar, criar e editar. Todo
// vinculado é resolvido pelo lead, e o lead pela organização ativa.

const NOT_PARTICIPANT_MESSAGE = "Só quem participa do tracking deste lead pode alterar os vinculados.";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const optionalText = (maxLength: number) => z.string().trim().max(maxLength).nullish();

const memberFieldsSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome").max(120),
  kind: optionalText(60),
  document: optionalText(40),
  birthDate: z.string().regex(DATE_ONLY).nullish(),
  phone: optionalText(30),
  email: z.string().trim().max(160).nullish(),
  notes: optionalText(2000),
  parentMemberId: z.string().nullish(),
  billingMode: z.enum(["TITULAR", "PROPRIO"]).optional(),
  /** Centro de custo do Financeiro para a conta de cobrança própria. */
  costCenterId: z.string().nullish(),
  /** Cria (ou reaproveita, pelo nome) um centro de custo e usa no lugar de `costCenterId`. */
  newCostCenterName: optionalText(80),
});

const MEMBER_SELECT = {
  id: true,
  leadId: true,
  parentMemberId: true,
  name: true,
  kind: true,
  document: true,
  birthDate: true,
  phone: true,
  email: true,
  notes: true,
  billingMode: true,
  costCenterId: true,
  archivedAt: true,
  promotedLeadId: true,
  createdAt: true,
} as const;

const toNullableText = (text: string | null | undefined) => (text && text.length > 0 ? text : null);
const toNullableDate = (dateOnly: string | null | undefined) => (dateOnly ? new Date(`${dateOnly}T00:00:00.000Z`) : null);

async function findLeadOfOrganization(leadId: string, organizationId: string) {
  return prisma.lead.findFirst({
    where: { id: leadId, tracking: { organizationId } },
    select: { id: true, name: true },
  });
}

/**
 * Centro de custo pedido para o vinculado: o existente (conferido na
 * organização), um novo pelo nome, ou nenhum. `undefined` = não mexer.
 */
async function resolveCostCenterId(params: {
  organizationId: string;
  costCenterId: string | null | undefined;
  newCostCenterName: string | null | undefined;
}): Promise<{ costCenterId: string | null | undefined; problem: string | null }> {
  const newName = params.newCostCenterName?.trim();
  if (newName) {
    const existing = await prisma.paymentCostCenter.findFirst({
      where: { organizationId: params.organizationId, name: { equals: newName, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) return { costCenterId: existing.id, problem: null };
    const created = await prisma.paymentCostCenter.create({
      data: { organizationId: params.organizationId, name: newName },
      select: { id: true },
    });
    return { costCenterId: created.id, problem: null };
  }
  if (!params.costCenterId) return { costCenterId: params.costCenterId, problem: null };
  const costCenter = await prisma.paymentCostCenter.findFirst({
    where: { id: params.costCenterId, organizationId: params.organizationId, isActive: true },
    select: { id: true },
  });
  return costCenter ? { costCenterId: costCenter.id, problem: null } : { costCenterId: undefined, problem: "Centro de custo não encontrado." };
}

/** Mensagem do problema com o pai escolhido, ou null se ele serve. */
async function describeParentProblem(params: { leadId: string; memberId: string | null; parentMemberId: string | null }): Promise<string | null> {
  if (!params.parentMemberId) return null;
  const siblings = await prisma.leadMember.findMany({
    where: { leadId: params.leadId },
    select: { id: true, parentMemberId: true, archivedAt: true, promotedLeadId: true },
  });
  const parent = siblings.find((member) => member.id === params.parentMemberId);
  if (!parent) return "O vinculado escolhido como nível acima não pertence a este lead.";
  if (parent.archivedAt || parent.promotedLeadId) return "O vinculado escolhido como nível acima está arquivado ou já virou lead.";
  if (params.memberId && wouldCreateCycle(siblings, params.memberId, params.parentMemberId)) {
    return "Um vinculado não pode ficar abaixo dele mesmo nem de alguém que está abaixo dele.";
  }
  const ownHeight = params.memberId ? subtreeHeight(siblings, params.memberId) : 1;
  if (depthUnderParent(siblings, params.parentMemberId) + ownHeight - 1 > MAX_MEMBER_DEPTH) {
    return `A hierarquia vai até ${MAX_MEMBER_DEPTH} níveis.`;
  }
  return null;
}

export const listLeadMembers = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "List the members linked to a lead", tags: ["Leads"] })
  .input(z.object({ leadId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const lead = await findLeadOfOrganization(input.leadId, context.org.id);
    if (!lead) throw errors.NOT_FOUND({ message: "Lead não encontrado" });

    const [members, recordCounts, organization, participation, costCenters] = await Promise.all([
      prisma.leadMember.findMany({ where: { leadId: lead.id }, orderBy: [{ createdAt: "asc" }], select: MEMBER_SELECT }),
      prisma.formRecord.groupBy({
        by: ["leadMemberId"],
        where: { leadId: lead.id, leadMemberId: { not: null } },
        _count: { _all: true },
      }),
      prisma.organization.findUnique({
        where: { id: context.org.id },
        select: { leadMemberLabelSingular: true, leadMemberLabelPlural: true },
      }),
      checkLeadTrackingParticipant(lead.id, context.user.id),
      prisma.paymentCostCenter.findMany({
        where: { organizationId: context.org.id, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);
    const recordCountByMemberId = new Map(recordCounts.map((group) => [group.leadMemberId, group._count._all]));

    return {
      lead,
      labels: resolveMemberLabels({ singular: organization?.leadMemberLabelSingular, plural: organization?.leadMemberLabelPlural }),
      canEdit: participation.ok,
      costCenters,
      members: members.map((member) => ({
        ...member,
        birthDate: member.birthDate ? member.birthDate.toISOString().slice(0, 10) : null,
        recordCount: recordCountByMemberId.get(member.id) ?? 0,
      })),
    };
  });

export const createLeadMember = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Create a member linked to a lead", tags: ["Leads"] })
  .input(memberFieldsSchema.extend({ leadId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const lead = await findLeadOfOrganization(input.leadId, context.org.id);
    if (!lead) throw errors.NOT_FOUND({ message: "Lead não encontrado" });
    const participation = await checkLeadTrackingParticipant(lead.id, context.user.id);
    if (!participation.ok) throw errors.FORBIDDEN({ message: NOT_PARTICIPANT_MESSAGE });

    const parentProblem = await describeParentProblem({ leadId: lead.id, memberId: null, parentMemberId: input.parentMemberId ?? null });
    if (parentProblem) throw errors.BAD_REQUEST({ message: parentProblem });

    const billingMode = input.billingMode ?? "TITULAR";
    const costCenter = await resolveCostCenterId({ organizationId: context.org.id, costCenterId: input.costCenterId, newCostCenterName: input.newCostCenterName });
    if (costCenter.problem) throw errors.BAD_REQUEST({ message: costCenter.problem });

    const member = await prisma.leadMember.create({
      data: {
        organizationId: context.org.id,
        leadId: lead.id,
        parentMemberId: input.parentMemberId ?? null,
        name: input.name,
        kind: toNullableText(input.kind),
        document: toNullableText(input.document),
        birthDate: toNullableDate(input.birthDate),
        phone: toNullableText(input.phone),
        email: toNullableText(input.email),
        notes: toNullableText(input.notes),
        billingMode,
        // Centro de custo só vale para quem tem conta própria.
        costCenterId: billingMode === "PROPRIO" ? (costCenter.costCenterId ?? null) : null,
      },
      select: { id: true },
    });
    return { id: member.id };
  });

export const updateLeadMember = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Update or archive a member linked to a lead", tags: ["Leads"] })
  .input(memberFieldsSchema.partial().extend({ id: z.string(), archived: z.boolean().optional() }))
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.leadMember.findFirst({
      where: { id: input.id, organizationId: context.org.id, lead: { tracking: { organizationId: context.org.id } } },
      select: { id: true, leadId: true, promotedLeadId: true, billingMode: true },
    });
    if (!member) throw errors.NOT_FOUND({ message: "Vinculado não encontrado" });
    if (member.promotedLeadId) throw errors.BAD_REQUEST({ message: "Este vinculado já virou lead; edite o lead." });
    const participation = await checkLeadTrackingParticipant(member.leadId, context.user.id);
    if (!participation.ok) throw errors.FORBIDDEN({ message: NOT_PARTICIPANT_MESSAGE });

    if (input.parentMemberId !== undefined) {
      const parentProblem = await describeParentProblem({ leadId: member.leadId, memberId: member.id, parentMemberId: input.parentMemberId ?? null });
      if (parentProblem) throw errors.BAD_REQUEST({ message: parentProblem });
    }

    const costCenter = await resolveCostCenterId({ organizationId: context.org.id, costCenterId: input.costCenterId, newCostCenterName: input.newCostCenterName });
    if (costCenter.problem) throw errors.BAD_REQUEST({ message: costCenter.problem });
    const nextBillingMode = input.billingMode ?? member.billingMode;

    await prisma.leadMember.update({
      where: { id: member.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.kind !== undefined && { kind: toNullableText(input.kind) }),
        ...(input.document !== undefined && { document: toNullableText(input.document) }),
        ...(input.birthDate !== undefined && { birthDate: toNullableDate(input.birthDate) }),
        ...(input.phone !== undefined && { phone: toNullableText(input.phone) }),
        ...(input.email !== undefined && { email: toNullableText(input.email) }),
        ...(input.notes !== undefined && { notes: toNullableText(input.notes) }),
        ...(input.parentMemberId !== undefined && { parentMemberId: input.parentMemberId ?? null }),
        ...(input.billingMode !== undefined && { billingMode: input.billingMode }),
        ...(nextBillingMode === "TITULAR" ? { costCenterId: null } : costCenter.costCenterId !== undefined ? { costCenterId: costCenter.costCenterId } : {}),
        ...(input.archived !== undefined && { archivedAt: input.archived ? new Date() : null }),
      },
    });
    return { id: member.id };
  });

export const updateLeadMemberLabels = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Rename how the organization calls lead members", tags: ["Leads"] })
  .input(z.object({ singular: z.string().trim().max(30), plural: z.string().trim().max(30) }))
  .handler(async ({ input, context, errors }) => {
    const membership = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true },
    });
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw errors.FORBIDDEN({ message: "Só administradores da empresa podem mudar esse nome." });
    }
    await prisma.organization.update({
      where: { id: context.org.id },
      data: { leadMemberLabelSingular: toNullableText(input.singular), leadMemberLabelPlural: toNullableText(input.plural) },
    });
    return resolveMemberLabels(input);
  });

export const promoteLeadMemberToLead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Turn a lead member into a lead of its own", tags: ["Leads"] })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.leadMember.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { leadId: true },
    });
    if (!member) throw errors.NOT_FOUND({ message: "Vinculado não encontrado" });
    const participation = await checkLeadTrackingParticipant(member.leadId, context.user.id);
    if (!participation.ok) throw errors.FORBIDDEN({ message: NOT_PARTICIPANT_MESSAGE });

    try {
      return await promoteLeadMember({ memberId: input.id, organizationId: context.org.id, actor: context.user });
    } catch (error) {
      if (error instanceof LeadMemberActionError) throw errors[error.code]({ message: error.message });
      throw error;
    }
  });

export const mergeLeadAsMember = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Turn an existing lead into a member of another lead", tags: ["Leads"] })
  .input(z.object({ titularLeadId: z.string(), sourceLeadId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const [titularParticipation, sourceParticipation] = await Promise.all([
      checkLeadTrackingParticipant(input.titularLeadId, context.user.id),
      checkLeadTrackingParticipant(input.sourceLeadId, context.user.id),
    ]);
    if (!titularParticipation.ok || !sourceParticipation.ok) {
      throw errors.FORBIDDEN({ message: "Você precisa participar do tracking dos dois leads para juntá-los." });
    }
    try {
      return await mergeLeadIntoMember({
        organizationId: context.org.id,
        sourceLeadId: input.sourceLeadId,
        titularLeadId: input.titularLeadId,
        actorId: context.user.id,
      });
    } catch (error) {
      if (error instanceof LeadMemberActionError) throw errors[error.code]({ message: error.message });
      throw error;
    }
  });
