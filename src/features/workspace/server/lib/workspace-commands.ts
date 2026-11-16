import "server-only";
import prisma from "@/lib/prisma";

// Criar workspace e coluna, usados pela tela (rotas oRPC) e pelo MCP (spec 0143, RF-10).

export const DEFAULT_WORKSPACE_COLUMNS = ["Para fazer", "Em progresso", "Em revisão", "Concluído"];

export interface WorkspaceColumnInput {
  name: string;
  color?: string;
}

/** Todos os membros da empresa entram no workspace; quem cria é OWNER. Sem colunas, nasce com as quatro padrão. */
export async function createWorkspaceRecord(params: {
  organizationId: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  trackingId?: string | null;
  columns?: WorkspaceColumnInput[];
}) {
  const members = await prisma.member.findMany({ where: { organizationId: params.organizationId }, select: { userId: true } });
  const columns: WorkspaceColumnInput[] = params.columns?.length ? params.columns : DEFAULT_WORKSPACE_COLUMNS.map((name) => ({ name }));

  return prisma.workspace.create({
    data: {
      name: params.name,
      description: params.description,
      organizationId: params.organizationId,
      createdBy: params.userId,
      icon: params.icon,
      trackingId: params.trackingId ?? null,
      members: {
        createMany: {
          data: members.map((member) => ({ role: member.userId === params.userId ? "OWNER" : "MEMBER", userId: member.userId })),
        },
      },
      columns: {
        createMany: { data: columns.map((column, index) => ({ name: column.name, color: column.color, order: index })) },
      },
    },
  });
}

/** Coluna nova no fim do quadro, ou logo depois de `afterColumnId`. O workspace já foi conferido por quem chama. */
export async function createWorkspaceColumnRecord(params: { workspaceId: string; name: string; color?: string; afterColumnId?: string }) {
  const columns = await prisma.workspaceColumn.findMany({
    where: { workspaceId: params.workspaceId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });

  let order = columns.length > 0 ? Number(columns[columns.length - 1].order) + 1 : 0;
  if (params.afterColumnId) {
    const position = columns.findIndex((column) => column.id === params.afterColumnId);
    if (position === -1) throw new Error("Coluna de referência não encontrada neste workspace.");
    const next = columns[position + 1];
    // `order` é Decimal: cabe no meio sem renumerar as outras.
    if (next) order = (Number(columns[position].order) + Number(next.order)) / 2;
  }

  return prisma.workspaceColumn.create({
    data: { workspaceId: params.workspaceId, name: params.name, color: params.color, order },
  });
}
