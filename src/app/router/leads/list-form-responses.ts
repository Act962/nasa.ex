import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { deriveResponseState } from "@/features/form/lib/form-response-state";
import {
  extractDeadlineConfigsFromResponse,
  isDeadlineFulfilled,
} from "@/features/form/lib/extract-deadline";

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
          completedAt: true,
          jsonResponse: true,
          label: true,
          form: {
            select: {
              id: true,
              name: true,
              jsonBlock: true,
              settings: true,
            },
          },
        },
      });

      // Eventos do lead pros últimos 90 dias — usados pra checar se algum
      // trigger configurado em `resetTriggers` dos DatePickers já foi
      // satisfeito (status mudou, tag, form submetido). 1 query batched.
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const leadEvents = await prisma.leadJourneyEvent.findMany({
        where: {
          leadId: input.leadId,
          kind: { in: ["status_changed", "tag_added", "form_submit"] },
          occurredAt: { gte: since },
        },
        select: { kind: true, occurredAt: true, metadata: true },
      });

      // Deriva o estado server-side e remove `jsonResponse`/`jsonBlock` do
      // payload. Cliente recebe só o que precisa pra renderizar resumo.
      // Também extrai o `deadline` (date field marcado com useAsDeadline)
      // pra que a UI mostre countdown ao lado do botão "Abrir" sem precisar
      // baixar o jsonResponse inteiro.
      //
      // Se `resetTriggers` foi configurado E algum trigger já aconteceu,
      // devolve `deadline: null` (badge some na UI).
      const enriched = responses.map((r) => {
        const configs = extractDeadlineConfigsFromResponse({
          jsonResponse: r.jsonResponse,
          jsonBlock: r.form.jsonBlock,
        });
        const activeConfig = configs.find(
          (c) =>
            !isDeadlineFulfilled({
              resetTriggers: c.resetTriggers,
              leadEvents,
              formCreatedAt: r.createdAt,
              jsonResponse: r.jsonResponse,
            }),
        );
        return {
          id: r.id,
          createdAt: r.createdAt,
          completedAt: r.completedAt,
          label: r.label,
          state: deriveResponseState({
            jsonResponse: r.jsonResponse,
            jsonBlock: r.form.jsonBlock,
            createdAt: r.createdAt,
          }),
          deadline: activeConfig ? activeConfig.date.toISOString() : null,
          // jsonBlock + settings expostos pra UI renderizar thumbnail
          // (FormFirstGroupThumbnail) no dialog "Formulários do lead" que
          // abre via ícone no LeadItem (kanban).
          form: {
            id: r.form.id,
            name: r.form.name,
            jsonBlock: r.form.jsonBlock,
            settings: r.form.settings,
          },
        };
      });

      return { responses: enriched };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
