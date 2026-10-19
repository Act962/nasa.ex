import type { Prisma } from "@/generated/prisma/client";
import {
  assignedStatusFlowPatch,
  consultantLoadWhere,
  queuedStatusFlowPatch,
} from "@/features/org-defaults/lib/attendance/rodizio";

type PrismaTx = Prisma.TransactionClient;

export async function assignLeadRoundRobin(prisma: PrismaTx, leadId: string) {
  // 1. Buscar lead
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      trackingId: true,
      tracking: { select: { organizationId: true } },
    },
  });

  if (!lead) {
    throw new Error("Lead not found");
  }
  const { organizationId } = lead.tracking;

  // 2. Buscar consultores
  const consultants = await prisma.trackingConsultant.findMany({
    where: {
      trackingId: lead.trackingId,
      isActive: true,
    },
    orderBy: {
      lastAssignedAt: { sort: 'asc', nulls: 'first' },
    },
  });

  // 3. fallback (sem consultores)
  if (!consultants.length) {
    return { status: "no-consultants" };
  }

  // 4. encontrar disponível
  let selectedConsultant = null;

  for (const c of consultants) {
    const leadsCount = await prisma.lead.count({
      where: consultantLoadWhere({ organizationId, trackingId: lead.trackingId, responsibleId: c.userId }),
    });

    if (leadsCount < c.maxFlow) {
      selectedConsultant = c;
      break;
    }
  }

  // 5. fallback (todos cheios)
  if (!selectedConsultant) {
    console.log("no consultant available for lead", leadId);
    await prisma.lead.update({
      where: { id: leadId },
      data: queuedStatusFlowPatch(organizationId),
    });

    return { status: "no-consultant-available" };
  }

  // 6. assign
  console.log(
    "assigning lead",
    leadId,
    "to consultant",
    selectedConsultant.userId,
  );
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      responsibleId: selectedConsultant.userId,
      ...assignedStatusFlowPatch(organizationId),
    },
  });

  // 7. update last assigned
  await prisma.trackingConsultant.update({
    where: { id: selectedConsultant.id },
    data: {
      lastAssignedAt: new Date(),
    },
  });

  return {
    status: "assigned",
    consultantId: selectedConsultant.userId,
  };
}
