import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Versão pública (sem auth) de `getResponseById`. Usada pela página
 * `/lead/<token>/formulario/<responseId>`, onde o cliente do lead consegue
 * VISUALIZAR a resposta do formulário (read-only) e assinar a SignatureClient.
 *
 * Auth: o lead precisa ter `publicToken` igual ao recebido. Sem token =
 * 404. Token errado = 404.
 */
export const getResponseByToken = base
  .route({
    method: "GET",
    path: "/forms/public-response/:responseId",
    summary: "Public read-only view of a form response, scoped to a lead token",
  })
  .input(
    z.object({
      token: z.string().min(10),
      responseId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const response = await prisma.formResponses.findFirst({
        where: {
          id: input.responseId,
          lead: { publicToken: input.token },
        },
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
              settings: true,
            },
          },
          lead: {
            select: {
              id: true,
              name: true,
              status: { select: { id: true, name: true, color: true } },
              tracking: { select: { id: true, name: true } },
              responsible: { select: { name: true, image: true } },
            },
          },
        },
      });

      if (!response) {
        throw errors.NOT_FOUND({ message: "Resposta não encontrada" });
      }

      // Mascarar parcialmente o nome do lead pra exibir só o primeiro nome
      // — mesma política da page `/lead/[token]`.
      const masked = response.lead?.name?.split(" ")[0] ?? "Cliente";

      return {
        response: {
          ...response,
          lead: response.lead
            ? { ...response.lead, name: masked }
            : null,
        },
      };
    } catch (error: any) {
      if (error?.code === "NOT_FOUND") throw error;
      console.error("[form/getResponseByToken]", error);
      throw errors.INTERNAL_SERVER_ERROR({
        message: error?.message || "Erro interno",
      });
    }
  });
