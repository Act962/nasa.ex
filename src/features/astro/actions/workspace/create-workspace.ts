import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";

// Criar workspace. Nasce sem coluna, como no orquestrador — o cartão leva
// direto ao quadro novo para o usuário montar as etapas.

const DEFAULT_COLOR = "#1447e6";

const inputSchema = z.object({
  workspaceName: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .describe("Nome do workspace, ex: 'Operação'."),
});

export const createWorkspaceAction: AstroAction<typeof inputSchema> = {
  key: "workspace.create",
  app: "workspaces",
  toolName: "create_workspace_board",
  description:
    "Cria um WORKSPACE novo — 'cria um workspace', 'novo quadro de tarefas chamado X'. " +
    "É o espaço de trabalho interno da equipe, não o funil de leads.",
  permission: { appKey: "workspace", action: "create" },
  requiresConfirmation: false,
  newNameFields: ["workspaceName"],
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const duplicate = await prisma.workspace.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: { equals: input.workspaceName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        status: "error",
        title: "Workspace já existe",
        description: `Já existe um workspace chamado "${input.workspaceName}".`,
        internalUrl: `/workspaces/${duplicate.id}`,
        openLabel: "Abrir Workspace",
        appName: "Workspaces",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Criar workspace",
        description: `O workspace "${input.workspaceName}" será criado.`,
        appName: "Workspaces",
      };
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: input.workspaceName,
        color: DEFAULT_COLOR,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
      },
      select: { id: true, name: true },
    });

    return {
      status: "done",
      title: "Workspace criado",
      description: `"${workspace.name}" está pronto para uso.`,
      internalUrl: `/workspaces/${workspace.id}`,
      openLabel: "Abrir Workspace",
      appName: "Workspaces",
    };
  },
};
