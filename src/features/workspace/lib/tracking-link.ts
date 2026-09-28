// Regras do vínculo Workspace → Tracking. Um tracking pode ter vários
// workspaces; o vínculo é opcional e não propaga permissão entre os dois
// domínios (ver docs/workspace-actions-overview.md §4.3).

import prisma from "@/lib/prisma";

export async function isTrackingAccessibleByUser({
  trackingId,
  organizationId,
  userId,
}: {
  trackingId: string;
  organizationId: string;
  userId: string;
}) {
  // Participação é exigida além do escopo de org: sem isso seria possível
  // vincular (e por tabela descobrir) trackings dos quais não se participa.
  const tracking = await prisma.tracking.findFirst({
    where: {
      id: trackingId,
      organizationId,
      isArchived: false,
      participants: {
        some: {
          userId,
        },
      },
    },
    select: { id: true },
  });

  return tracking !== null;
}
