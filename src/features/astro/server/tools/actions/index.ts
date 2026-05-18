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
        "Cria uma Action (tarefa/evento) em um workspace. TODOS os campos são OPCIONAIS — use defaults SEMPRE que o user não informar: workspace ausente = mais usado pelo user; título ausente = 'Nova ação do {nome do user}'; dueDate ausente = hoje. NÃO pergunte priority, type, description, lead, projeto — o user completa manualmente no card depois. NÃO peça pra o user confirmar workspace/data/título se ele não mencionou — chame a tool direto com o que tem; os defaults preenchem.",
      inputSchema: z.object({
        workspaceId: z
          .string()
          .optional()
          .describe(
            "Opcional. Sem isso, usa o workspace mais usado pelo user (com mais Actions criadas por ele).",
          ),
        title: z
          .string()
          .max(200)
          .optional()
          .describe(
            "Opcional. Sem isso, vira 'Nova ação do {nome do user}'.",
          ),
        description: z.string().optional(),
        dueDate: z
          .string()
          .optional()
          .describe(
            "Data ISO 8601 com timezone (ex: '2026-05-17T10:00:00-03:00') OU 'YYYY-MM-DD' OU palavra relativa ('hoje', 'amanhã'). O servidor parseia. Sem isso, default = hoje fim do dia.",
          ),
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
        // ── Resolve workspace (default = mais usado pelo user) ──
        let resolvedWorkspaceId = workspaceId;
        if (!resolvedWorkspaceId) {
          // Top workspace por nº de Actions criadas por este user na org
          const grouped = await prisma.action.groupBy({
            by: ["workspaceId"],
            where: {
              createdBy: ctx.userId,
              organizationId: ctx.organizationId,
              isArchived: false,
            },
            _count: { _all: true },
            orderBy: { _count: { workspaceId: "desc" } },
            take: 1,
          });
          if (grouped[0]) {
            resolvedWorkspaceId = grouped[0].workspaceId;
          } else {
            // Sem histórico — pega o workspace mais recente da org que o
            // user tem acesso.
            const fallback = await prisma.workspace.findFirst({
              where: {
                organizationId: ctx.organizationId,
                isArchived: false,
                OR: [
                  { visibility: "PUBLIC" },
                  { createdBy: ctx.userId },
                  { members: { some: { userId: ctx.userId } } },
                ],
              },
              orderBy: { updatedAt: "desc" },
              select: { id: true },
            });
            if (!fallback) {
              return {
                error:
                  "Sem workspace disponível pra criar a action — crie um primeiro em /workspaces.",
              };
            }
            resolvedWorkspaceId = fallback.id;
          }
        }

        if (!(await userCanAccessWorkspace(ctx.userId, resolvedWorkspaceId))) {
          return { error: "Sem acesso ao workspace" };
        }
        const ws = await prisma.workspace.findUnique({
          where: { id: resolvedWorkspaceId },
          select: { organizationId: true, name: true },
        });
        if (!ws) return { error: "Workspace não encontrado" };

        // ── Resolve título (default = "Nova ação do {nome}") ──
        let resolvedTitle = title?.trim();
        if (!resolvedTitle) {
          const u = await prisma.user.findUnique({
            where: { id: ctx.userId },
            select: { name: true },
          });
          const userName = u?.name?.trim() || "usuário";
          resolvedTitle = `Nova ação do ${userName}`;
        }

        // ── Resolve dueDate (default = AGORA, conforme spec do user) ──
        // Aceita ISO 8601 com qualquer timezone, "YYYY-MM-DD", ou
        // palavras relativas ("hoje", "amanhã").
        let resolvedDueDate: Date;
        if (!dueDate) {
          resolvedDueDate = new Date();
        } else {
          const lower = dueDate.toLowerCase().trim();
          if (lower === "hoje" || lower === "today") {
            resolvedDueDate = new Date();
          } else if (
            lower === "amanhã" ||
            lower === "amanha" ||
            lower === "tomorrow"
          ) {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            resolvedDueDate = d;
          } else {
            const parsed = new Date(dueDate);
            if (Number.isNaN(parsed.getTime())) {
              return {
                error: `Data inválida: "${dueDate}". Use ISO ('2026-05-17T10:00:00-03:00'), 'YYYY-MM-DD', 'hoje' ou 'amanhã'.`,
              };
            }
            resolvedDueDate = parsed;
          }
        }

        // ── Resolve columnId (default = primeira coluna do workspace) ──
        const firstColumn = await prisma.workspaceColumn.findFirst({
          where: { workspaceId: resolvedWorkspaceId },
          orderBy: { order: "asc" },
          select: { id: true },
        });

        let action;
        try {
          action = await prisma.action.create({
            data: {
              title: resolvedTitle,
              description: description ?? null,
              workspaceId: resolvedWorkspaceId,
              columnId: firstColumn?.id ?? null,
              organizationId: ws.organizationId,
              createdBy: ctx.userId,
              dueDate: resolvedDueDate,
              priority: priority ?? ActionPriority.NONE,
              type: type ?? TypeAction.TASK,
              // Auto-inclui o criador como participante (spec do user:
              // "sempre incluir o usuário criador").
              participants: {
                create: { userId: ctx.userId },
              },
            },
            select: {
              id: true,
              title: true,
              dueDate: true,
              priority: true,
              workspaceId: true,
            },
          });
        } catch (err) {
          // Erro de Prisma: relata pro LLM com diagnóstico claro pra
          // facilitar debug do user.
          console.error("[astro/create_action] prisma falhou:", err);
          return {
            error: `Falhou ao gravar a action no banco: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
        return {
          ok: true,
          action,
          workspaceName: ws.name,
          appliedDefaults: {
            workspace: !workspaceId,
            title: !title,
            dueDate: !dueDate,
          },
        };
      },
    }),
  };
}
