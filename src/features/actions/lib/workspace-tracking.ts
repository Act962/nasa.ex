// Herança do vínculo Workspace → Tracking para as Actions. Uma action nasce
// (e permanece) com o tracking do workspace onde vive; workspace sem vínculo
// produz `null`. Ver docs/workspace-actions-overview.md §5, Fase 2.

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import prismaDefault from "@/lib/prisma";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function resolveWorkspaceTrackingId(
  workspaceId: string,
  prisma: PrismaLike = prismaDefault,
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { trackingId: true },
  });

  return workspace?.trackingId ?? null;
}
