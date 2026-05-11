import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { deriveResponseState } from "@/features/form/lib/form-response-state";

/**
 * Lista todas as respostas de formulários vinculadas a um lead.
 *
 * Retorna o **estado visual** (5 estados — `empty`/`in_progress`/`waiting_…`/`stale`/`complete`)
 * e o **label customizado** de cada resposta server-side, evitando trafegar
 * `jsonResponse` cheio até o cliente. Consumida pela aba "Formulários" do
 * detalhe do lead (`lead-form-responses.tsx`), que agrupa por form e mostra
 * 1 linha por formulário com resumo da última resposta.
 */
export const listFormResponsesByLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List form responses linked to a lead",
    tags: ["Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const responses = await prisma.formResponses.findMany({
        where: { leadId: input.leadId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          jsonResponse: true,
          label: true,
          form: {
            select: {
              id: true,
              name: true,
              jsonBlock: true,
            },
          },
        },
      });

      // Deriva o estado server-side e remove `jsonResponse`/`jsonBlock` do
      // payload. Cliente recebe só o que precisa pra renderizar resumo.
      const enriched = responses.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        label: r.label,
        state: deriveResponseState({
          jsonResponse: r.jsonResponse,
          jsonBlock: r.form.jsonBlock,
          createdAt: r.createdAt,
        }),
        form: { id: r.form.id, name: r.form.name },
      }));

      return { responses: enriched };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
