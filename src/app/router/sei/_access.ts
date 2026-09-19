import prisma from "@/lib/prisma";

export async function assertLeadInOrganization(leadId: string, organizationId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tracking: { organizationId } },
    select: { id: true },
  });
  if (!lead) throw new Error("Lead não encontrado nesta organização.");
  return lead;
}
