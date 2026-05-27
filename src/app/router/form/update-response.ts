import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { recordLeadEvent } from "@/features/leads/lib/history";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import {
  checkLeadTrackingParticipant,
  NOT_TRACKING_PARTICIPANT_MESSAGE,
} from "@/features/leads/lib/tracking-participant-guard";
import { deriveResponseLabel } from "@/features/form/lib/derive-response-label";
import { syncFormLabelsToLeadDescription } from "@/features/form/lib/sync-form-labels-to-lead-description";
import { applyResponseTagsToLead } from "@/features/form/lib/apply-response-tags";

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
      /**
       * Se true, aplica o "Direcionamento" do form (FormSettings.trackingId
       * + statusId) movendo o lead pro tracking/status configurado. Usado
       * no submit final — não no auto-save partial.
       */
      isFinal: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { id, response, isFinal } = input;
      const userId = context.user.id;

      // Carrega resposta + settings do form (pra Direcionamento quando
      // isFinal=true). Inclui `labelManuallyEdited` + `form.jsonBlock`
      // para re-derivar o `label` automático sem sobrescrever overrides.
      const existing = await prisma.formResponses.findFirst({
        where: { id },
        select: {
          id: true,
          leadId: true,
          formId: true,
          labelManuallyEdited: true,
          form: {
            select: {
              organizationId: true,
              jsonBlock: true,
              settings: { select: { trackingId: true, statusId: true } },
            },
          },
        },
      });

      if (!existing) {
        throw errors.NOT_FOUND({ message: "Resposta não encontrada" });
      }

      // Membership check (org-level — defesa em profundidade)
      const member = await prisma.member.findFirst({
        where: { organizationId: existing.form.organizationId, userId },
        select: { id: true },
      });
      if (!member) {
        throw errors.UNAUTHORIZED({
          message: "Você não tem acesso a esta resposta",
        });
      }

      // Tracking participant check — usuário precisa participar do
      // tracking ATUAL do lead pra editar respostas.
      if (existing.leadId) {
        const { ok } = await checkLeadTrackingParticipant(
          existing.leadId,
          userId,
        );
        if (!ok) {
          throw errors.FORBIDDEN({
            message: NOT_TRACKING_PARTICIPANT_MESSAGE,
          });
        }
      }

      // Re-deriva label automático SOMENTE quando o user nunca fez
      // override manual (`labelManuallyEdited === false`). Caso contrário
      // mantém o `label` que está salvo (manual prevalece).
      const dataToUpdate: { jsonResponse: string; label?: string | null } = {
        jsonResponse: response,
      };
      if (!existing.labelManuallyEdited) {
        dataToUpdate.label = deriveResponseLabel({
          jsonBlock: existing.form.jsonBlock,
          jsonResponse: response,
        });
      }

      const updated = await prisma.formResponses.update({
        where: { id: existing.id },
        data: dataToUpdate,
        select: {
          id: true,
          createdAt: true,
          leadId: true,
          label: true,
        },
      });

      // Propaga label pra Lead.description (textareas no card + observações)
      // — fire-and-forget, não bloqueia a resposta da procedure.
      syncFormLabelsToLeadDescription(prisma, updated.leadId).catch(() => {});

      // Aplica tags da resposta no lead (radio/checkbox blocks com tagId).
      // Aqui é o caminho que roda quando o operador clica "Próximo" no form
      // sendo preenchido (auto-save chama updateResponse). Sem isso, tags
      // escolhidas no fluxo interno nunca chegavam no card do lead.
      if (updated.leadId) {
        const tagsApplied = await applyResponseTagsToLead(
          prisma,
          updated.leadId,
          response,
        );
        if (tagsApplied > 0) {
          await recordLeadEvent({
            leadId: updated.leadId,
            eventType: "TAG_ADDED",
            metadata: {
              source: "form_response_update",
              formId: existing.formId,
              formResponseId: updated.id,
              count: tagsApplied,
            },
          });
        }

        // Direcionamento — move o lead pro tracking/status configurado
        // no FormSettings quando o submit é final. Idempotente.
        if (
          isFinal &&
          existing.form.settings?.trackingId &&
          existing.form.settings?.statusId
        ) {
          const currentLead = await prisma.lead.findUnique({
            where: { id: updated.leadId },
            select: { trackingId: true, statusId: true },
          });
          if (
            currentLead &&
            (currentLead.trackingId !== existing.form.settings.trackingId ||
              currentLead.statusId !== existing.form.settings.statusId)
          ) {
            await prisma.lead.update({
              where: { id: updated.leadId },
              data: {
                trackingId: existing.form.settings.trackingId,
                statusId: existing.form.settings.statusId,
              },
            });
            await recordLeadEvent({
              leadId: updated.leadId,
              eventType: "STATUS_CHANGE",
              metadata: {
                source: "form_redirect",
                formId: existing.formId,
                formResponseId: updated.id,
                newTrackingId: existing.form.settings.trackingId,
                newStatusId: existing.form.settings.statusId,
              },
            });
          }
        }
      }

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
            label: updated.label ?? null,
          },
        });

        // Espelha em LeadJourneyEvent com `actorId` pra que a jornada do
        // lead mostre QUEM atualizou. `occurredAt = now` (não o createdAt
        // da resposta) pra que cada edição vire um entry separado na
        // timeline em vez de colidir com a criação original via dedup.
        await trackLeadEvent({
          leadId: updated.leadId,
          kind: "form_submit",
          actorId: userId,
          metadata: {
            formId: existing.formId,
            formResponseId: updated.id,
            edited: true,
            label: updated.label ?? null,
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
