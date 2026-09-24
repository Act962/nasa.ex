import "server-only";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";

// Criar demanda/tarefa dentro de um workspace. Sem este verbo, "adicione a
// demanda CRIAR SITE dentro de DEMANDAS" caía em `workspace.create` e
// respondia que o workspace já existia — o buraco de verbo ausente de novo.

const inputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .describe("O que precisa ser feito, ex: 'Criar site'."),
  workspaceName: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Workspace onde a demanda entra. Sem isso, usa o único."),
});

export const createWorkspaceActionItem: AstroAction<typeof inputSchema> = {
  key: "action.create",
  app: "workspaces",
  toolName: "create_workspace_task",
  description:
    "Cria uma DEMANDA/tarefa dentro de um workspace — 'adicione a demanda X', 'cria a tarefa X em Y', " +
    "'anota essa atividade'. É o cartão de trabalho, não o quadro inteiro.",
  permission: { appKey: "workspace", action: "create" },
  requiresConfirmation: false,
  newNameFields: ["title"],
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const workspaces = await prisma.workspace.findMany({
      where: {
        organizationId: ctx.organizationId,
        isArchived: false,
        ...(input.workspaceName
          ? { name: { contains: input.workspaceName, mode: "insensitive" } }
          : {}),
      },
      select: { id: true, name: true },
      take: 8,
    });

    if (workspaces.length === 0) {
      return {
        status: "needs_input",
        title: "Workspace não encontrado",
        description: input.workspaceName
          ? `Não achei workspace com "${input.workspaceName}".`
          : "Você ainda não tem workspace nenhum. Crie um antes.",
        missingFields: [{ key: "workspaceName", label: "o nome do workspace" }],
        appName: "Workspaces",
      };
    }

    if (workspaces.length > 1) {
      return {
        status: "ambiguous",
        title: "Em qual workspace?",
        description: `Você tem ${workspaces.length} workspaces. Em qual crio?`,
        field: "workspaceName",
        options: workspaces.map((item) => ({ id: item.id, label: item.name })),
        appName: "Workspaces",
      };
    }

    const workspace = workspaces[0];

    if (dryRun) {
      return {
        status: "done",
        title: "Criar demanda",
        description: `"${input.title}" entrará em ${workspace.name}.`,
        appName: "Workspaces",
      };
    }

    // Primeira coluna do quadro é onde toda demanda nova nasce; sem coluna,
    // o cartão fica sem lugar e some da visão de board.
    const column = await prisma.workspaceColumn.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { order: "asc" },
      select: { id: true },
    });

    const last = await prisma.action.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const created = await prisma.action.create({
      data: {
        title: input.title,
        workspaceId: workspace.id,
        columnId: column?.id ?? null,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        order: last ? new Decimal(last.order).plus(1) : new Decimal(0),
      },
      select: { id: true },
    });

    return {
      status: "done",
      title: "Demanda criada",
      description: `"${input.title}" entrou em ${workspace.name}.`,
      internalUrl: `/workspaces/${workspace.id}?action=${created.id}`,
      openLabel: "Abrir demanda",
      appName: "Workspaces",
    };
  },
};
