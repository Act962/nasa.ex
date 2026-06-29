import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { resolveLeadAttachments } from "@/features/leads/lib/attachments";

/**
 * Versão pública (sem auth) que retorna os anexos do lead via `publicToken`.
 * Usada pela página `/lead/<token>` pra o cliente final ter acesso a todos
 * os arquivos do atendimento dele (anexos manuais, mídias do chat, anexos
 * dos formulários).
 *
 * Privacidade: usa `lead.publicToken` como segredo de acesso. Sem token =
 * 404. Quem tem o link tem acesso ao mesmo conjunto de itens da aba
 * Arquivos (com a diferença que o cliente pode visualizar / baixar mas
 * não pode adicionar nem remover).
 */
export const listAttachmentsByToken = base
  .route({
    method: "GET",
    path: "/leads/public/:token/attachments",
    summary: "Public list of lead attachments (token-scoped)",
    tags: ["Leads"],
  })
  .input(
    z.object({
      token: z.string().min(10),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const lead = await (
        prisma.lead.findFirst as (args: unknown) => Promise<unknown>
      )({
        where: { publicToken: input.token },
        select: { id: true },
      });
      const id = (lead as { id?: string } | null)?.id;
      if (!id) throw errors.NOT_FOUND;

      const items = await resolveLeadAttachments(id, 250);
      return { items };
    } catch (err: any) {
      if (err?.code === "NOT_FOUND") throw err;
      console.error("[lead.listAttachmentsByToken]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
