import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { recordLeadEvent } from "@/features/leads/lib/history";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import {
  checkLeadTrackingParticipant,
  NOT_TRACKING_PARTICIPANT_MESSAGE,
} from "@/features/leads/lib/tracking-participant-guard";
import { deriveResponseLabel } from "@/features/form/lib/derive-response-label";
import { applyResponseTagsToLead } from "@/features/form/lib/apply-response-tags";

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
      /**
       * Se true, aplica o "Direcionamento" do form (FormSettings.trackingId
       * + statusId) movendo o lead pro tracking/status configurado. Usado
       * no submit final — não no auto-save de cada "Próximo".
       */
      isFinal: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { formId, leadId, response, isFinal } = input;
      const userId = context.user.id;

      // Carrega form (incluindo settings.trackingId/statusId pro
      // "Direcionamento" quando isFinal=true) e lead em paralelo.
      const [form, lead] = await Promise.all([
        prisma.form.findUnique({
          where: { id: formId },
          select: {
            id: true,
            organizationId: true,
            jsonBlock: true,
            settings: { select: { trackingId: true, statusId: true } },
          },
        }),
        prisma.lead.findUnique({
          where: { id: leadId },
          select: {
            id: true,
            trackingId: true,
            statusId: true,
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

      // User precisa ser membro da org do form/lead (defesa em profundidade).
      const member = await prisma.member.findFirst({
        where: { organizationId: form.organizationId, userId },
        select: { id: true },
      });
      if (!member) {
        throw errors.UNAUTHORIZED({
          message: "Você não tem acesso a esta organização",
        });
      }

      // Regra de NEGÓCIO: user precisa ser participante do tracking
      // ATUAL do lead pra criar respostas.
      const { ok } = await checkLeadTrackingParticipant(leadId, userId);
      if (!ok) {
        throw errors.FORBIDDEN({
          message: NOT_TRACKING_PARTICIPANT_MESSAGE,
        });
      }

      // Auto-deriva o título customizado (label) a partir do bloco marcado
      // com `useAsResponseLabel`. `labelManuallyEdited=false` na criação —
      // saves seguintes podem re-derivar até o user editar manualmente.
      const autoLabel = deriveResponseLabel({
        jsonBlock: form.jsonBlock,
        jsonResponse: response,
      });

      const created = await prisma.formResponses.create({
        data: {
          jsonResponse: response,
          formId,
          leadId,
          label: autoLabel,
          labelManuallyEdited: false,
        },
        select: {
          id: true,
          createdAt: true,
          label: true,
        },
      });

      // Incrementa contador (mantém paridade com submitResponse público).
      await prisma.form.update({
        where: { id: formId },
        data: { responses: { increment: 1 } },
      });

      // Aplica tags da resposta no lead (radio/checkbox blocks com tagId).
      // Paridade com submitResponse público — sem isso, tags escolhidas no
      // preenchimento interno não apareciam no card do lead.
      const tagsApplied = await applyResponseTagsToLead(
        prisma,
        leadId,
        response,
      );
      if (tagsApplied > 0) {
        await recordLeadEvent({
          leadId,
          eventType: "TAG_ADDED",
          metadata: {
            source: "form_response_internal",
            formId,
            formResponseId: created.id,
            count: tagsApplied,
          },
        });
      }

      // Direcionamento (FormSettings.trackingId/statusId) — move o lead
      // quando o submit é final e a config existe. Idempotente: pula
      // quando já estiver no destino.
      if (
        isFinal &&
        form.settings?.trackingId &&
        form.settings?.statusId &&
        (lead.trackingId !== form.settings.trackingId ||
          lead.statusId !== form.settings.statusId)
      ) {
        await prisma.lead.update({
          where: { id: leadId },
          data: {
            trackingId: form.settings.trackingId,
            statusId: form.settings.statusId,
          },
        });
        await recordLeadEvent({
          leadId,
          eventType: "STATUS_CHANGED",
          metadata: {
            source: "form_redirect",
            formId,
            formResponseId: created.id,
            newTrackingId: form.settings.trackingId,
            newStatusId: form.settings.statusId,
          },
        });
      }

      await recordLeadEvent({
        leadId,
        eventType: "FORM_SUBMITTED",
        metadata: {
          formResponseId: created.id,
          formId,
          source: "internal",
          createdBy: userId,
          // Label vai no metadata pra renderização imediata em timelines
          // sem precisar de outra query.
          label: created.label ?? null,
        },
      });

      // Espelha em LeadJourneyEvent pra que a jornada do lead mostre QUEM
      // preencheu o formulário (avatar + nome). Sem isso, o entry caía pro
      // fallback de FormResponses na timeline com `actor: null`. O dedup
      // por (kind, segundo) faz este journey_event "vencer" o fallback —
      // ele tem score maior e carrega o actorId.
      await trackLeadEvent({
        leadId,
        kind: "form_submit",
        actorId: userId,
        occurredAt: created.createdAt,
        metadata: {
          formId,
          formResponseId: created.id,
          source: "internal",
          label: created.label ?? null,
        },
      });

      // Cobra Stars conforme regra global `form_response_with_lead`.
      await chargeStarsByAction(
        form.organizationId,
        "form_response_with_lead",
        {
          userId,
          description: "Resposta de formulário (lead vinculado)",
          appSlug: "forms",
        },
      );

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
