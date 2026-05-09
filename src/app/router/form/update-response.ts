import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { recordLeadEvent } from "@/features/leads/lib/history";

/**
 * Atualiza o `jsonResponse` de uma `FormResponses` existente. Usado no fluxo
 * de "Continuar preenchimento" — usuários autorizados (logados na mesma
 * organização do form) acessam `/formulario/[slug]/[responseId]` e completam
 * a resposta original.
 *
 * Difere de `submitResponse` (que cria nova resposta + lead): aqui não cria
 * lead nem incrementa contadores; só sobrescreve a resposta com a versão mais
 * recente. Registra evento `FORM_SUBMITTED` no histórico do lead com flag de
 * "edit" no metadata pra rastreabilidade.
 */
export const updateResponse = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    path: "/forms/responses/:id",
    summary: "Update an existing form response (resume-fill flow)",
  })
  .input(
    z.object({
      id: z.string(),
      response: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { id, response } = input;
      const userId = context.user.id;

      // Carrega a resposta sem filtrar por org ativa — depois verificamos
      // que o user é membro da org do form (ver create-response-for-lead.ts).
      const existing = await prisma.formResponses.findFirst({
        where: { id },
        select: {
          id: true,
          leadId: true,
          formId: true,
          form: { select: { organizationId: true } },
        },
      });

      if (!existing) {
        throw errors.NOT_FOUND({ message: "Resposta não encontrada" });
      }

      // Membership check
      const member = await prisma.member.findFirst({
        where: { organizationId: existing.form.organizationId, userId },
        select: { id: true },
      });
      if (!member) {
        throw errors.UNAUTHORIZED({
          message: "Você não tem acesso a esta resposta",
        });
      }

      const updated = await prisma.formResponses.update({
        where: { id: existing.id },
        data: {
          jsonResponse: response,
        },
        select: {
          id: true,
          createdAt: true,
          leadId: true,
        },
      });

      // Histórico: marca como FORM_SUBMITTED com flag de edição
      if (updated.leadId) {
        await recordLeadEvent({
          leadId: updated.leadId,
          eventType: "FORM_SUBMITTED",
          metadata: {
            formResponseId: updated.id,
            formId: existing.formId,
            edited: true,
            editedBy: userId,
          },
        });
      }

      return {
        message: "Resposta atualizada com sucesso",
        response: updated,
      };
    } catch (error: any) {
      console.error("[form/updateResponse]", error);
      if (error?.code === "NOT_FOUND" || error?.code === "BAD_REQUEST") {
        throw error;
      }
      throw errors.INTERNAL_SERVER_ERROR({
        message: error?.message || "Erro interno",
      });
    }
  });
