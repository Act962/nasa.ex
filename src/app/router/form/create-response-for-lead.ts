import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { recordLeadEvent } from "@/features/leads/lib/history";

/**
 * Cria uma `FormResponses` em nome de um consultor logado, vinculando ao
 * lead já existente. Usado pela página `/formulario/novo/<formId>/<leadId>`,
 * onde a Jessica (ou qualquer consultor com acesso) preenche um formulário
 * pra um lead que ainda não respondeu aquele form.
 *
 * Diferente de `submitResponse` (público): aqui o usuário está logado, o
 * lead já existe, e não disparamos workflow de "novo lead". Apenas:
 *  - cria a resposta com `jsonResponse`
 *  - incrementa `form.responses`
 *  - registra evento `FORM_SUBMITTED` no histórico do lead com flag
 *    `source: "internal"` e o `userId` que preencheu
 */
export const createResponseForLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/forms/:formId/responses/lead/:leadId",
    summary: "Create a form response on behalf of a lead (internal user)",
  })
  .input(
    z.object({
      formId: z.string(),
      leadId: z.string(),
      response: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { formId, leadId, response } = input;
      const userId = context.user.id;

      // Carrega form e lead sem filtrar por org ativa — checamos coerência
      // entre os dois (mesma org) e que o user é membro daquela org.
      const [form, lead] = await Promise.all([
        prisma.form.findUnique({
          where: { id: formId },
          select: { id: true, organizationId: true },
        }),
        prisma.lead.findUnique({
          where: { id: leadId },
          select: {
            id: true,
            tracking: { select: { organizationId: true } },
          },
        }),
      ]);

      if (!form) throw errors.NOT_FOUND({ message: "Form não encontrado" });
      if (!lead) throw errors.NOT_FOUND({ message: "Lead não encontrado" });

      // Cross-tenant: form e lead precisam ser da mesma org.
      if (form.organizationId !== lead.tracking.organizationId) {
        throw errors.BAD_REQUEST({
          message: "Form e lead pertencem a organizações diferentes",
        });
      }

      // User precisa ser membro da org do form/lead.
      const member = await prisma.member.findFirst({
        where: { organizationId: form.organizationId, userId },
        select: { id: true },
      });
      if (!member) {
        throw errors.UNAUTHORIZED({
          message: "Você não tem acesso a esta organização",
        });
      }

      const created = await prisma.formResponses.create({
        data: {
          jsonResponse: response,
          formId,
          leadId,
        },
        select: {
          id: true,
          createdAt: true,
        },
      });

      // Incrementa contador (mantém paridade com submitResponse público).
      await prisma.form.update({
        where: { id: formId },
        data: { responses: { increment: 1 } },
      });

      await recordLeadEvent({
        leadId,
        eventType: "FORM_SUBMITTED",
        metadata: {
          formResponseId: created.id,
          formId,
          source: "internal",
          createdBy: userId,
        },
      });

      return {
        message: "Resposta criada com sucesso",
        response: created,
      };
    } catch (error: any) {
      console.error("[form/createResponseForLead]", error);
      if (error?.code === "NOT_FOUND" || error?.code === "BAD_REQUEST") {
        throw error;
      }
      throw errors.INTERNAL_SERVER_ERROR({
        message: error?.message || "Erro interno",
      });
    }
  });
