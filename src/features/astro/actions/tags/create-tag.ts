import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";

// Criar tag. Sem verbo próprio, "crie uma tag com o nome X" caía no
// orquestrador, que perguntava o escopo e perdia a conversa no turno
// seguinte — a resposta "Tracking" virava um pedido novo.

const DEFAULT_COLOR = "#dc2626";

const inputSchema = z.object({
  tagName: z.string().trim().min(2).max(40).describe("Nome da tag."),
  scope: z
    .enum(["tracking", "workspace"])
    .describe("Onde a tag será usada: 'tracking' (leads) ou 'workspace' (tarefas)."),
  workspaceName: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Só para escopo workspace: a tag pertence a um workspace."),
});

function toSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const createTagAction: AstroAction<typeof inputSchema> = {
  key: "tag.create",
  app: "tracking",
  toolName: "create_tag_in_org",
  description:
    "Cria uma TAG/etiqueta nova — 'cria uma tag chamada X', 'nova etiqueta X'. " +
    "Pergunte o escopo quando o usuário não disser: tag de tracking marca leads, tag de workspace marca tarefas.",
  requiresConfirmation: false,
  newNameFields: ["tagName"],
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    if (input.scope === "workspace") {
      // Tag de workspace pertence a UM workspace — não à organização.
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
            : "Você ainda não tem workspace nenhum.",
          missingFields: [{ key: "workspaceName", label: "o nome do workspace" }],
          appName: "Workspaces",
        };
      }
      if (workspaces.length > 1) {
        return {
          status: "ambiguous",
          title: "Em qual workspace?",
          description: "A tag pertence a um workspace. Em qual delas crio?",
          field: "workspaceName",
          options: workspaces.map((item) => ({ id: item.id, label: item.name })),
          appName: "Workspaces",
        };
      }

      const workspace = workspaces[0];
      const duplicate = await prisma.workspaceTag.findFirst({
        where: {
          workspaceId: workspace.id,
          name: { equals: input.tagName, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (duplicate) {
        return {
          status: "error",
          title: "Tag já existe",
          description: `Já existe a tag "${input.tagName}" em ${workspace.name}.`,
          appName: "Workspaces",
        };
      }
      if (dryRun) {
        return {
          status: "done",
          title: "Criar tag",
          description: `"${input.tagName}" será criada em ${workspace.name}.`,
          appName: "Workspaces",
        };
      }
      await prisma.workspaceTag.create({
        data: { name: input.tagName, workspaceId: workspace.id },
      });
      return {
        status: "done",
        title: "Tag criada",
        description: `"${input.tagName}" está disponível em ${workspace.name}.`,
        internalUrl: `/workspaces/${workspace.id}`,
        openLabel: "Abrir Workspace",
        appName: "Workspaces",
      };
    }

    const duplicate = await prisma.tag.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: { equals: input.tagName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        status: "error",
        title: "Tag já existe",
        description: `Já existe a tag "${input.tagName}" no Tracking.`,
        appName: "Tracking",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Criar tag",
        description: `"${input.tagName}" será criada para o Tracking.`,
        appName: "Tracking",
      };
    }

    await prisma.tag.create({
      data: {
        name: input.tagName,
        slug: toSlug(input.tagName),
        color: DEFAULT_COLOR,
        organizationId: ctx.organizationId,
      },
    });

    return {
      status: "done",
      title: "Tag criada",
      description: `"${input.tagName}" está disponível para marcar leads.`,
      internalUrl: "/tracking",
      openLabel: "Abrir Tracking",
      appName: "Tracking",
    };
  },
};
