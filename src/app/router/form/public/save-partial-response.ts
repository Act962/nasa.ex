import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import {
  trackingParamsSchema,
  trackingToLeadData,
} from "@/lib/tracking/tracking-params";
import { recordLeadEvent } from "@/features/leads/lib/history";
import { publishLeadCreated } from "@/features/leads/realtime/publish";
import { deriveResponseLabel } from "@/features/form/lib/derive-response-label";
import { syncFormLabelsToLeadDescription } from "@/features/form/lib/sync-form-labels-to-lead-description";

/**
 * Salvamento INCREMENTAL de uma resposta de formulário público — usado
 * pelo botão "Próximo" do FormSubmitComponent. Dois modos:
 *
 *  - **Sem `responseId`** (primeira chamada): cria a `FormResponses` com
 *    o que já foi preenchido até então, ACHA OU CRIA o lead pelo telefone
 *    (mesma lógica do `submitResponse` final), incrementa o contador do
 *    form, registra evento `FORM_STARTED` na timeline. Devolve o
 *    `responseId` pro client guardar e reusar.
 *
 *  - **Com `responseId`**: faz `update` do `jsonResponse`. Sem mexer em
 *    lead, sem incrementar contador, sem registrar novo evento. Só
 *    persiste o estado atual e re-deriva o `label` automático (se ainda
 *    não foi editado manualmente). Exige `completedAt: null` — uma
 *    resposta já finalizada (via `submitResponse`) não aceita mais
 *    autosave, mesmo que o client ainda tenha o `responseId` em mãos (ex:
 *    aba antiga que não recebeu o ack do submit). Retorna `NOT_FOUND`
 *    nesse caso.
 *
 * Diferente de `submitResponse`: NÃO dispara workflows do botão "Próximo",
 * NÃO dispara onboarding Inngest, NÃO marca conclusão. A submissão final
 * continua sendo via `submitResponse` (que aceita `responseId` agora pra
 * "finalizar" um draft em vez de criar duplicata).
 *
 * Resultado UX: o lead aparece em "Detalhes do lead > Formulários > Todos
 * os forms" assim que clica o primeiro "Próximo" — o consultor já pode
 * abrir e acompanhar em tempo real. Conexão caindo? Tudo já está salvo.
 */
export const savePartialResponse = base
  .route({
    method: "POST",
    path: "/forms/public/:id/save-partial",
    summary: "Auto-save incremental de resposta — sem efeitos finais",
  })
  .input(
    z.object({
      id: z.string(),
      response: z.string(),
      tracking: trackingParamsSchema.optional(),
      /**
       * Quando presente, faz UPDATE do `FormResponses` existente. Quando
       * ausente, CRIA. O client gerencia esse estado (guarda o id devolvido
       * pela primeira chamada e envia nas seguintes).
       */
      responseId: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const { id, response, tracking: trackingParams, responseId } = input;

      // ── Modo UPDATE ────────────────────────────────────────────────
      if (responseId) {
        const existing = await prisma.formResponses.findFirst({
          where: { id: responseId, formId: id, completedAt: null },
          select: {
            id: true,
            leadId: true,
            labelManuallyEdited: true,
            form: { select: { jsonBlock: true } },
          },
        });
        if (!existing) {
          throw errors.NOT_FOUND({ message: "Resposta não encontrada" });
        }

        // Re-deriva label automático SOMENTE se o user nunca editou manualmente.
        const dataToUpdate: { jsonResponse: string; label?: string | null } = {
          jsonResponse: response,
        };
        if (!existing.labelManuallyEdited) {
          dataToUpdate.label = deriveResponseLabel({
            jsonBlock: existing.form.jsonBlock,
            jsonResponse: response,
          });
        }

        await prisma.formResponses.update({
          where: { id: existing.id },
          data: dataToUpdate,
        });

        // Propaga labels → Lead.description (textareas card + observações)
        syncFormLabelsToLeadDescription(prisma, existing.leadId).catch(() => {});

        return {
          responseId: existing.id,
          leadId: existing.leadId,
          created: false,
        };
      }

      // ── Modo CREATE ────────────────────────────────────────────────
      // Parse pra extrair dados do lead (mesma lógica do submitResponse).
      let parsedResponse: Record<string, unknown> = {};
      try {
        parsedResponse = JSON.parse(response);
      } catch {
        // Response malformado — segue com objeto vazio; ainda criamos o
        // FormResponses (vai aparecer no kanban como "iniciado"/empty).
      }

      const userName =
        typeof parsedResponse.user_name === "string"
          ? parsedResponse.user_name
          : "Sem nome";
      const userEmail =
        typeof parsedResponse.user_email === "string"
          ? parsedResponse.user_email
          : null;
      const userPhone =
        typeof parsedResponse.user_phone === "string"
          ? parsedResponse.user_phone
          : null;

      const form = await prisma.form.findUnique({
        where: { id, published: true },
        select: {
          id: true,
          jsonBlock: true,
          settings: { select: { trackingId: true, statusId: true } },
        },
      });
      if (!form) throw errors.NOT_FOUND({ message: "Form não encontrado" });

      const { trackingId, statusId } = form.settings ?? {};
      let leadId: string | null = null;
      // Só publicamos `lead-created` no board quando ESTE save criou o lead
      // (não quando reaproveitou um existente pelo telefone).
      let didCreateLead = false;

      // Acha lead existente pelo phone (dentro do tracking) ou cria novo.
      // Mesma lógica do submitResponse, mas isolada numa transação separada
      // pra não bloquear caso o lead já exista.
      if (trackingId && statusId && userPhone) {
        const existingLead = await prisma.lead.findUnique({
          where: {
            phone_trackingId: { phone: userPhone, trackingId },
          },
          select: { id: true },
        });
        if (existingLead) {
          leadId = existingLead.id;
        }
      }

      if (!leadId && trackingId && statusId) {
        const newLead = await prisma.lead.create({
          data: {
            name: userName,
            email: userEmail,
            phone: userPhone,
            trackingId,
            statusId,
            source: "FORM",
            ...trackingToLeadData(trackingParams),
          },
          select: { id: true },
        });
        leadId = newLead.id;
        didCreateLead = true;
      }

      // Cria a FormResponses + incrementa contador (1x só, mesmo se
      // chamado várias vezes em concorrência — usar transaction).
      const autoLabel = deriveResponseLabel({
        jsonBlock: form.jsonBlock,
        jsonResponse: response,
      });

      const created = await prisma.$transaction(async (tx) => {
        const fr = await tx.formResponses.create({
          data: {
            jsonResponse: response,
            formId: form.id,
            ...(leadId && { leadId }),
            label: autoLabel,
            labelManuallyEdited: false,
          },
          select: { id: true, leadId: true },
        });
        await tx.form.update({
          where: { id: form.id },
          data: { responses: { increment: 1 } },
        });
        return fr;
      });

      // Propaga labels → Lead.description (textareas card + observações)
      syncFormLabelsToLeadDescription(prisma, created.leadId).catch(() => {});

      // Realtime do board: lead recém-criado neste auto-save → aparece ao
      // vivo na coluna do tracking. Best-effort (helper isola erro).
      if (didCreateLead && leadId && trackingId && statusId) {
        await publishLeadCreated({ leadId, trackingId, statusId, source: "form" });
      }

      // Timeline: FORM_STARTED (não FORM_SUBMITTED — só o submit final).
      if (created.leadId) {
        try {
          await recordLeadEvent({
            leadId: created.leadId,
            eventType: "FORM_STARTED",
            metadata: {
              formId: form.id,
              formResponseId: created.id,
              source: "public",
            },
          });
        } catch (evtErr) {
          // Falha de tracking não bloqueia o save.
          console.warn("[form/savePartial] FORM_STARTED record failed", evtErr);
        }
      }

      return {
        responseId: created.id,
        leadId: created.leadId,
        created: true,
      };
    } catch (error: unknown) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "NOT_FOUND" || code === "BAD_REQUEST") throw error;
      console.error("[form/savePartialResponse]", error);
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });
