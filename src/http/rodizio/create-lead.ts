import prisma from "@/lib/prisma";

type PrismaTx = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function assignLeadRoundRobin(prisma: PrismaTx, leadId: string) {
  // 1. Buscar lead
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      trackingId: true,
    },
  });

  if (!lead) {
    throw new Error("Lead not found");
  }

  // 2. Buscar consultores
  const consultants = await prisma.trackingConsultant.findMany({
    where: {
      trackingId: lead.trackingId,
      isActive: true,
    },
  });

  // 3. fallback (sem consultores)
  if (!consultants.length) {
    return { status: "no-consultants" };
  }

  // 4. shuffle
  const shuffled = [...consultants].sort(() => Math.random() - 0.5);

  // 5. encontrar disponível
  let selectedConsultant = null;

  for (const c of shuffled) {
    const leadsCount = await prisma.lead.count({
      where: {
        responsibleId: c.userId,
        trackingId: lead.trackingId,
        isActive: true,
      },
    });

    if (leadsCount < c.maxFlow) {
      selectedConsultant = c;
      break;
    }
  }

  // 6. fallback (todos cheios)
  if (!selectedConsultant) {
    console.log("no consultant available for lead", leadId);
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        statusFlow: "WAITING",
      },
    });

    return { status: "no-consultant-available" };
  }

  // 7. assign
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
      statusFlow: "ACTIVE",
    },
  });

  return {
    status: "assigned",
    consultantId: selectedConsultant.userId,
  };
}
