import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Busca uma `FormResponses` específica por ID, retornando junto:
 *  - o form completo (jsonBlock + settings) — pra renderizar o form na UI
 *    de "Continuar preenchimento" (`/formulario/[slug]/[responseId]`).
 *  - os dados do lead vinculado (status atual + responsável + cor) pra
 *    exibir contexto na barra superior da página.
 *
 * Auth: usuário precisa estar logado e na mesma organização do form.
 */
export const getResponseById = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/forms/responses/:id",
    summary: "Fetch a single form response by ID (for resume-fill flow)",
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { id } = input;
      const userId = context.user.id;

      // Carrega a resposta sem filtrar por org ativa — depois verificamos
      // que o usuário é membro da org do form. Isso evita 404 falsos quando
      // o `activeOrganizationId` da sessão está null/desatualizado.
      const response = await prisma.formResponses.findFirst({
        where: { id },
        select: {
          id: true,
          createdAt: true,
          jsonResponse: true,
          form: {
            select: {
              id: true,
              name: true,
              jsonBlock: true,
              published: true,
              organizationId: true,
              settings: true,
            },
          },
          lead: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              publicToken: true,
              status: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
              responsible: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
              tracking: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!response) {
        throw errors.NOT_FOUND({ message: "Resposta não encontrada" });
      }

      // Verifica que o user é membro da org do form.
      const member = await prisma.member.findFirst({
        where: { organizationId: response.form.organizationId, userId },
        select: { id: true },
      });
      if (!member) {
        throw errors.UNAUTHORIZED({
          message: "Você não tem acesso a esta resposta",
        });
      }

      return { response };
    } catch (error: any) {
      console.error("[form/getResponseById]", error);
      if (error?.code === "NOT_FOUND" || error?.code === "BAD_REQUEST") {
        throw error;
      }
      throw errors.INTERNAL_SERVER_ERROR({
        message: error?.message || "Erro interno",
      });
    }
  });
