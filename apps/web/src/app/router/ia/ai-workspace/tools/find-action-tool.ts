import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const findActionTool = (
  userId: string,
  workspaceId?: string,
  orgId?: string,
) =>
  tool({
    description: [
      "Busca e lista ações/tarefas/eventos acessíveis ao usuário.",
      "REGRA CRÍTICA: NÃO preencha nenhum campo opcional por dedução ou por padrão.",
      "Cada campo só deve ser enviado se o usuário mencionar EXPLICITAMENTE aquele critério no prompt.",
      "Exemplo: se o usuário disser 'liste todos os eventos', chame a tool com ZERO campos — nenhum filtro.",
      "Exemplo: só passe isDone:true se o usuário disser 'concluídas' ou 'feitas'.",
      "Semepre que falar em ação, evento, tarefa, em todas as linguagens, ele está se referino a Actions",
    ].join(" "),
    inputSchema: z
      .object({
        // Text filters
        title: z
          .string()
          .optional()
          .describe(
            "SOMENTE se o usuário mencionar um nome/título específico. NÃO preencha por padrão.",
          ),

        // Status / type filters
        isDone: z
          .boolean()
          .optional()
          .describe(
            "SOMENTE se o usuário pedir explicitamente 'concluídas' (true) ou 'pendentes' (false). NÃO preencha por padrão — omitir retorna ambas.",
          ),
        isArchived: z
          .boolean()
          .optional()
          .describe(
            "SOMENTE se o usuário pedir explicitamente arquivadas (true). Padrão false oculta arquivadas automaticamente.",
          ),

        // Pagination
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(10)
          .describe("Máximo de resultados. Padrão 10."),
        offset: z.number().min(0).default(0).describe("Offset para paginação."),
      })
      .strip(),
    execute: async ({ title, isDone, isArchived, limit, offset }) => {
      console.log("FIND ACTION TOOL CALL");
      try {
        const actions = await prisma.action.findMany({
          where: {
            ...(workspaceId
              ? { workspaceId }
              : orgId
                ? { organizationId: orgId }
                : {}),

            ...(title && {
              title: { contains: title, mode: "insensitive" },
            }),
            ...(isDone !== undefined && { isDone }),
            ...(isArchived !== undefined && { isArchived }),
          },
          orderBy: [{ order: "asc" }, { createdAt: "desc" }],
          take: limit,
          skip: offset,
          select: {
            id: true,
            title: true,
            description: true,
            isDone: true,
            type: true, // TASK | ACTION | MEETING | NOTE
            priority: true,
            dueDate: true,
            startDate: true,
            endDate: true,
            columnId: true,
            isArchived: true,
            isFavorited: true,
            createdAt: true,
            responsibles: {
              select: {
                user: {
                  select: { id: true, name: true, image: true },
                },
              },
            },
            participants: {
              select: {
                user: {
                  select: { id: true, name: true, image: true },
                },
              },
            },
            column: {
              select: { id: true, name: true },
            },
          },
        });

        if (actions.length === 0) {
          return {
            success: true,
            message: "Nenhuma tarefa encontrada com os critérios informados.",
            hint: "Sugira ao usuário refinar a busca ou criar uma nova ação.",
            actions: [],
            total: 0,
          };
        }

        const serializedActions = actions.map((action) => ({
          ...action,
          dueDate: action.dueDate?.toISOString() ?? null,
          startDate: action.startDate?.toISOString() ?? null,
          endDate: action.endDate?.toISOString() ?? null,
          createdAt: action.createdAt?.toISOString() ?? null,
        }));

        return {
          success: true,
          message: `${actions.length} action(s) found.`,
          actions: serializedActions,
          total: serializedActions.length,
        };
      } catch (error) {
        return {
          success: false,
          message:
            "Não foi possível buscar as tarefas agora. Tente novamente em instantes.",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  });
