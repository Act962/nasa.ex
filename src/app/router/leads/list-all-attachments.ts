import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { resolveLeadAttachments } from "@/features/leads/lib/attachments";

/**
 * Versão internal (autenticada) que retorna TODOS os anexos do lead já
 * agrupados em pastas (Arquivos, Chat, Formulários). Usada pela aba
 * "Arquivos" do detalhe do lead pra o consultor ter visão unificada.
 */
export const listAllAttachments = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/leads/:leadId/attachments",
    summary: "List all attachments of a lead grouped by source",
    tags: ["Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: input.leadId },
        select: { id: true },
      });
      if (!lead) throw errors.NOT_FOUND;

      const items = await resolveLeadAttachments(input.leadId, 250);
      return { items };
    } catch (err: any) {
      if (err?.code === "NOT_FOUND") throw err;
      console.error("[lead.listAllAttachments]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
