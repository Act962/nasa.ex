// Isolamento de tenant das procedures de workspace. Espelha o
// `actions/server/lib/action-access.ts` (Fase 5): toda rota que recebe id de
// recurso valida a org antes de ler/escrever. Recursos workspace-nativos
// (coluna, tag, automação) escopam pelo workspace dono; folder escopa direto
// pela org. Ver docs/workspace-actions-overview.md §6.1, débito S6.

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import prismaDefault from "@/lib/prisma";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export function findWorkspaceInOrg(
  workspaceId: string,
  organizationId: string,
  prisma: PrismaLike = prismaDefault,
) {
  return prisma.workspace.findFirst({
    where: { id: workspaceId, organizationId },
    select: { id: true, trackingId: true, name: true },
  });
}

export function findColumnInOrg(
  columnId: string,
  organizationId: string,
  prisma: PrismaLike = prismaDefault,
) {
  return prisma.workspaceColumn.findFirst({
    where: { id: columnId, workspace: { organizationId } },
    select: { id: true, workspaceId: true, name: true, color: true },
  });
}

export function findTagInOrg(
  tagId: string,
  organizationId: string,
  prisma: PrismaLike = prismaDefault,
) {
  return prisma.workspaceTag.findFirst({
    where: { id: tagId, workspace: { organizationId } },
    select: { id: true, workspaceId: true, name: true, color: true },
  });
}

export function findAutomationInOrg(
  automationId: string,
  organizationId: string,
  prisma: PrismaLike = prismaDefault,
) {
  return prisma.workspaceAutomation.findFirst({
    where: { id: automationId, workspace: { organizationId } },
    select: { id: true, workspaceId: true },
  });
}

export function findFolderInOrg(
  folderId: string,
  organizationId: string,
  prisma: PrismaLike = prismaDefault,
) {
  return prisma.workspaceFolder.findFirst({
    where: { id: folderId, organizationId },
    select: { id: true },
  });
}
