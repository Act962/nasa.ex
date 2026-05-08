import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Retorna apenas os dados básicos do lead (nome, e-mail, telefone) a partir do
 * `publicToken`. Usado para pré-preencher formulários públicos quando o link
 * é compartilhado com o cliente, ex: `/submit-form/[id]?leadToken=...`.
 *
 * Não registra evento de visualização nem expõe dados sensíveis.
 */
export const getLeadPrefillByToken = base
  .route({
    method: "GET",
    path: "/leads/public/{token}/prefill",
    summary: "Public prefill data for forms",
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
        select: { name: true, email: true, phone: true },
      });
      if (!lead) throw errors.NOT_FOUND;
      const data = lead as { name: string; email: string | null; phone: string | null };
      return {
        prefill: {
          name: data.name ?? "",
          email: data.email ?? "",
          phone: data.phone ?? "",
        },
      };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
