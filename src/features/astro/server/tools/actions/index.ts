import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ActionPriority, TypeAction } from "@/generated/prisma/enums";
import type { AgentContext } from "@/features/astro/server/agents/types";
import {
  userBelongsToOrg,
  userCanAccessWorkspace,
} from "@/features/astro/server/tools/_shared/permissions";

/**
 * Tools de Actions/SubActions/Workspaces para o sub-agente Task Agent.
 * Mantém criação simples; campos opcionais podem ser preenchidos depois pelo
 * usuário na UI.
 */
export function buildActionTools(ctx: AgentContext) {
  return {
    list_workspaces: tool({
      description:
        "Lista os workspaces da organização atual aos quais o usuário tem acesso. Use para ajudar o usuário a escolher onde criar uma Action.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { error: "Sem acesso à organização" };
        }
        const workspaces = await prisma.workspace.findMany({
          where: {
            organizationId: ctx.organizationId,
            isArchived: false,
            OR: [
              { visibility: "PUBLIC" },
              { createdBy: ctx.userId },
              { members: { some: { userId: ctx.userId } } },
            ],
          },
          select: {
            id: true,
            name: true,
            description: true,
            visibility: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 30,
        });
        return { workspaces };
      },
    }),

    create_action: tool({
      description:
        "Cria uma Action (tarefa) em um workspace. Confirme o workspaceId e o título com o usuário antes de chamar.",
      inputSchema: z.object({
        workspaceId: z.string(),
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        dueDate: z
          .string()
          .datetime()
          .optional()
          .describe("ISO 8601, ex: 2026-05-08T15:00:00.000Z"),
        priority: z.nativeEnum(ActionPriority).optional(),
        type: z.nativeEnum(TypeAction).optional(),
      }),
      execute: async ({
        workspaceId,
        title,
        description,
        dueDate,
        priority,
        type,
      }) => {
        if (!(await userCanAccessWorkspace(ctx.userId, workspaceId))) {
          return { error: "Sem acesso ao workspace" };
        }
        const ws = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { organizationId: true },
        });
        if (!ws) return { error: "Workspace não encontrado" };

        const action = await prisma.action.create({
          data: {
            title,
            description: description ?? null,
            workspaceId,
            organizationId: ws.organizationId,
            createdBy: ctx.userId,
            dueDate: dueDate ? new Date(dueDate) : null,
            priority: priority ?? ActionPriority.NONE,
            type: type ?? TypeAction.TASK,
          },
          select: { id: true, title: true, dueDate: true, priority: true },
        });
        return { ok: true, action };
      },
    }),
  };
}
