import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const findUserTool = (workspaceId: string) =>
  tool({
    description: [
      "Busca usuários membros do workspace atual pelo nome ou email.",
      "Use esta tool ANTES de findAction quando o usuário mencionar o nome de uma pessoa.",
      "Exemplo: 'ações do João' → chame findUser com name='João' para obter o userId, depois passe para findAction.",
    ].join(" "),
    inputSchema: z.object({
      name: z
        .string()
        .optional()
        .describe("Nome ou parte do nome do usuário a buscar."),
      email: z
        .string()
        .optional()
        .describe("Email do usuário, se mencionado explicitamente."),
    }),
    execute: async ({ name, email }) => {
      try {
        const members = await prisma.workspaceMember.findMany({
          where: {
            workspaceId,
            user: {
              ...(name && { name: { contains: name, mode: "insensitive" } }),
              ...(email && { email: { contains: email, mode: "insensitive" } }),
              isActive: true,
            },
          },
          select: {
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                nickname: true,
                image: true,
              },
            },
          },
          take: 10,
        });

        if (members.length === 0) {
          return {
            success: true,
            message: "Nenhum membro encontrado com esse nome neste workspace.",
            users: [],
          };
        }

        return {
          success: true,
          message: `${members.length} membro(s) encontrado(s) no workspace.`,
          users: members.map((m) => ({ ...m.user, role: m.role })),
        };
      } catch (error) {
        return {
          success: false,
          message: "Não foi possível buscar os membros do workspace.",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  });
