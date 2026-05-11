import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { deriveResponseState } from "@/features/form/lib/form-response-state";

/**
 * Lista todas as respostas de um lead pra UM formulário específico.
 *
 * Consumida pela página dedicada
 * `/contatos/<leadId>/formularios/<formId>` que mostra cada resposta como
 * uma linha (data, autor, label, estado) com ações de abrir/copiar link.
 *
 * Retorna `state` derivado server-side; `jsonResponse` NÃO é trafegado.
 * Auth: user precisa ser membro da org dona do form/lead.
 */
export const listResponsesOfForm = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/leads/{leadId}/forms/{formId}/responses",
    summary: "List all responses of a specific form for a lead",
    tags: ["Leads", "Form"],
  })
  .input(
    z.object({
      leadId: z.string(),
      formId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const userId = context.user.id;

      const [form, lead] = await Promise.all([
        prisma.form.findUnique({
          where: { id: input.formId },
          select: {
            id: true,
            name: true,
            organizationId: true,
            jsonBlock: true,
          },
        }),
        prisma.lead.findUnique({
          where: { id: input.leadId },
          select: {
            id: true,
            name: true,
            tracking: { select: { organizationId: true } },
          },
        }),
      ]);
      if (!form) throw errors.NOT_FOUND({ message: "Form não encontrado" });
      if (!lead) throw errors.NOT_FOUND({ message: "Lead não encontrado" });
      if (form.organizationId !== lead.tracking.organizationId) {
        throw errors.BAD_REQUEST({
          message: "Form e lead pertencem a organizações diferentes",
        });
      }

      // Membership na org (defesa em profundidade)
      const member = await prisma.member.findFirst({
        where: { organizationId: form.organizationId, userId },
        select: { id: true },
      });
      if (!member) {
        throw errors.UNAUTHORIZED({
          message: "Você não tem acesso a este formulário",
        });
      }

      const responses = await prisma.formResponses.findMany({
        where: { leadId: input.leadId, formId: input.formId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          jsonResponse: true,
          label: true,
          labelManuallyEdited: true,
        },
      });

      const enriched = responses.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        label: r.label,
        labelManuallyEdited: r.labelManuallyEdited,
        state: deriveResponseState({
          jsonResponse: r.jsonResponse,
          jsonBlock: form.jsonBlock,
          createdAt: r.createdAt,
        }),
      }));

      return {
        form: { id: form.id, name: form.name },
        lead: { id: lead.id, name: lead.name },
        responses: enriched,
      };
    } catch (err: any) {
      if (
        err?.code === "NOT_FOUND" ||
        err?.code === "BAD_REQUEST" ||
        err?.code === "UNAUTHORIZED"
      ) {
        throw err;
      }
      console.error("[leads/listResponsesOfForm]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
