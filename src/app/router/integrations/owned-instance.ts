import prisma from "@/lib/prisma";

// Escopo de tenant das procedures de instância de WhatsApp: o id vem do client, então
// tracking e instância só valem se forem da organização ativa. Sem isso, um usuário de
// outra empresa conectava, desconectava ou apagava a instância alheia, ou criava uma no
// tracking dela (o `trackingId` é único e a vítima ficava sem conseguir criar a própria).

export async function isTrackingOfOrganization(trackingId: string, organizationId: string): Promise<boolean> {
  const tracking = await prisma.tracking.findFirst({
    where: { id: trackingId, organizationId },
    select: { id: true },
  });
  return tracking !== null;
}

export async function findOrganizationInstanceByInstanceId(instanceId: string, organizationId: string) {
  return prisma.whatsAppInstance.findFirst({
    where: { instanceId, organizationId },
    select: { id: true, instanceName: true, phoneNumber: true, organizationId: true, trackingId: true },
  });
}
