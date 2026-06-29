import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { recordLeadEvent } from "@/features/leads/lib/history";
import {
  checkLeadTrackingParticipant,
  NOT_TRACKING_PARTICIPANT_MESSAGE,
} from "@/features/leads/lib/tracking-participant-guard";

/**
 * Registra que o consultor ABRIU um formulário pra um lead — disparado no
 * mount da página `/formulario/novo/<formId>/<leadId>`. Marca um evento
 * `FORM_STARTED` no histórico, que aparece na timeline interna E no link
 * público (`/lead/<token>`) quase em tempo real (via Pusher).
 *
 * Diferente de `createResponseForLead`, esta procedure NÃO cria um
 * `FormResponses`; só registra o evento. A criação real só acontece no
 * submit do form.
 *
 * Idempotência: se o consultor entrou e saiu múltiplas vezes nos últimos
 * 10 minutos, NÃO duplica o evento — evita poluir a timeline.
 */
export const recordFormOpening = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/forms/:formId/lead/:leadId/opening",
    summary: "Mark that a consultant opened a form for a lead",
  })
  .input(
    z.object({
      formId: z.string(),
      leadId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const userId = context.user.id;

      // Confirma que form e lead existem e pertencem à mesma org.
      const [form, lead] = await Promise.all([
        prisma.form.findUnique({
          where: { id: input.formId },
          select: { id: true, name: true, organizationId: true },
        }),
        prisma.lead.findUnique({
          where: { id: input.leadId },
          select: {
            id: true,
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

      // Tracking participant guard.
      const { ok } = await checkLeadTrackingParticipant(input.leadId, userId);
      if (!ok) {
        throw errors.FORBIDDEN({ message: NOT_TRACKING_PARTICIPANT_MESSAGE });
      }

      // Idempotência curta (30s): protege contra dupla execução do
      // `useEffect` em React StrictMode (dev) ou refresh acidental logo
      // após abrir. NÃO usamos janela larga porque agora múltiplos
      // preenchimentos concorrentes do mesmo form pro mesmo lead são
      // legítimos (ex: cliente com 2 carros, abre Checklist pra cada um
      // em sequência) e cada abertura intencional vira um evento próprio.
      const THIRTY_SEC_AGO = new Date(Date.now() - 30 * 1000);
      const recent = await prisma.leadJourneyEvent.findFirst({
        where: {
          leadId: input.leadId,
          actorId: userId,
          kind: "form_submit",
          occurredAt: { gte: THIRTY_SEC_AGO },
          metadata: {
            path: ["formId"],
            equals: input.formId,
          },
        },
        select: { id: true },
      });
      if (recent) {
        return { message: "Já registrado recentemente", recordedNow: false };
      }

      await recordLeadEvent({
        leadId: input.leadId,
        eventType: "FORM_STARTED",
        userId,
        metadata: {
          formId: input.formId,
          formName: form.name,
          started: true,
        },
      });

      return { message: "Abertura registrada", recordedNow: true };
    } catch (err: any) {
      if (
        err?.code === "NOT_FOUND" ||
        err?.code === "BAD_REQUEST" ||
        err?.code === "FORBIDDEN"
      ) {
        throw err;
      }
      console.error("[form/recordFormOpening]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
