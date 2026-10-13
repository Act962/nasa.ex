import "server-only";
import prisma from "@/lib/prisma";
import {
  computeClosing,
  parseSharedCostGroups,
  type ClosingComputation,
  type SharedCostGroup,
} from "@/features/form-records/lib/compute-closing";

// Leitura do fechamento de um período (spec 0075, RF-10). Aberto: calculado na
// hora a partir das fichas. Fechado: as linhas gravadas são a verdade.

export async function loadClosingComputation(params: {
  organizationId: string;
  formId: string;
  periodKey: string;
  groups: SharedCostGroup[];
}): Promise<ClosingComputation> {
  const records = await prisma.formRecord.findMany({
    where: { organizationId: params.organizationId, formId: params.formId, periodKey: params.periodKey },
    select: { leadId: true, leadMemberId: true, usageTotalCents: true, finalizedAt: true },
  });
  const memberIds = [...new Set(records.map((record) => record.leadMemberId).filter((memberId): memberId is string => memberId !== null))];
  const members =
    memberIds.length > 0
      ? await prisma.leadMember.findMany({
          where: { id: { in: memberIds }, organizationId: params.organizationId },
          select: { id: true, name: true, billingMode: true, costCenterId: true },
        })
      : [];
  const leadIds = [...new Set(records.map((record) => record.leadId).filter((leadId): leadId is string => leadId !== null))];
  const leads =
    leadIds.length > 0
      ? await prisma.lead.findMany({
          where: { id: { in: leadIds }, tracking: { organizationId: params.organizationId } },
          select: { id: true, name: true },
        })
      : [];
  return computeClosing({
    records: records.map((record) => ({
      leadId: record.leadId,
      leadMemberId: record.leadMemberId,
      usageTotalCents: record.usageTotalCents,
      isFinalized: record.finalizedAt !== null,
    })),
    groups: params.groups,
    leadNameById: new Map(leads.map((lead) => [lead.id, lead.name])),
    memberInfoById: new Map(
      members.map((member) => [member.id, { name: member.name, billingMode: member.billingMode, costCenterId: member.costCenterId }]),
    ),
  });
}

export async function findClosing(params: { organizationId: string; formId: string; periodKey: string }) {
  const closing = await prisma.formClosing.findUnique({
    where: {
      organizationId_formId_periodKey: {
        organizationId: params.organizationId,
        formId: params.formId,
        periodKey: params.periodKey,
      },
    },
    include: { lines: { orderBy: [{ leadName: "asc" }, { leadId: "asc" }, { leadMemberName: "asc" }] } },
  });
  return closing ? { ...closing, groups: parseSharedCostGroups(closing.sharedCostGroups) } : null;
}
