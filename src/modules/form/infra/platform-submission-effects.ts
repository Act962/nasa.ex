import { awardPoints } from "@/app/router/space-point/utils";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { eventBus } from "@/features/alerts/lib/event-bus";
import { dispatchFormAnswerTagFlows } from "@/features/form/lib/dispatch-answer-tag-flows";
import { syncFormLabelsToLeadDescription } from "@/features/form/lib/sync-form-labels-to-lead-description";
import { generateActionsForResponse } from "@/features/form/server/lib/generate-actions-for-response";
import { recordLeadEvent } from "@/features/leads/lib/history";
import { publishLeadCreated, publishLeadMoved } from "@/features/leads/realtime/publish";
import type { Prisma } from "@/generated/prisma/client";
import { inngest } from "@/inngest/client";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import type { AppPrismaClient } from "@/lib/prisma";
import type { DraftEffects } from "../ports/draft-effects";
import type { SubmissionEffects } from "../ports/submission-effects";

// Efeitos do envio executados pelos mesmos helpers que o handler de origem
// chamava, com o mesmo tratamento de falha de cada um: o que lá estava em
// try/catch continua tolerado aqui, e o que não estava continua propagando.

const LOG_PREFIX = "[form/submit]";

export function createPlatformSubmissionEffects(prisma: AppPrismaClient): SubmissionEffects {
  return {
    async awardResponseMilestone({ formId, formOwnerId, organizationId, action }) {
      try {
        await awardPoints(formOwnerId, organizationId, action, undefined, { formId });
      } catch (awardError) {
        console.error(`${LOG_PREFIX} SpacePoint award error:`, awardError);
      }
    },

    async recordLeadEvents(events) {
      await Promise.all(
        events.map((event) =>
          recordLeadEvent({ ...event, metadata: event.metadata as Prisma.InputJsonValue | undefined }),
        ),
      );
    },

    async trackJourneyEvents(events) {
      await Promise.all(events.map((event) => trackLeadEvent(event)));
    },

    async dispatchAnswerTagFlows({ leadId, answerTagIds }) {
      await dispatchFormAnswerTagFlows({ leadId, answerTagIds: [...answerTagIds] }).catch(
        (dispatchError: unknown) =>
          console.error(`${LOG_PREFIX} disparo dos fluxos por tag falhou:`, dispatchError),
      );
    },

    async publishLeadCreated(createdLead) {
      await publishLeadCreated({ ...createdLead, source: "form" });
    },

    async startNewLeadWorkflow({ leadId, trackingId }) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/workflows/lead/new?trackingId=${trackingId}&leadId=${leadId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trackingId }),
          },
        );
      } catch (workflowError) {
        console.error(`${LOG_PREFIX} workflow lead/new falhou:`, workflowError);
      }
    },

    async publishLeadMoved(move) {
      await publishLeadMoved(move);
    },

    async publishLeadStatusChanged(change) {
      await eventBus.publish("lead.status_changed", change);
    },

    syncFormLabelsToLead(leadId) {
      syncFormLabelsToLeadDescription(prisma, leadId).catch(() => {});
    },

    async logSubmissionActivity(formId) {
      try {
        const form = await prisma.form.findUnique({
          where: { id: formId },
          select: {
            id: true,
            name: true,
            organizationId: true,
            createdBy: { select: { id: true, name: true, email: true, image: true } },
          },
        });
        if (!form?.createdBy) return;

        await logActivity({
          organizationId: form.organizationId,
          userId: form.createdBy.id,
          userName: form.createdBy.name,
          userEmail: form.createdBy.email,
          userImage: form.createdBy.image,
          appSlug: "forms",
          subAppSlug: "forms-responses",
          featureKey: "forms.response.submitted",
          action: "forms.response.submitted",
          actionLabel: `Resposta recebida no formulário "${form.name}"`,
          resource: form.name,
          resourceId: form.id,
          metadata: { isPublicSubmission: true },
        });
      } catch (logError) {
        console.error(`${LOG_PREFIX} logActivity error:`, logError);
      }
    },

    // O alerta usa a resposta mais recente do formulário, como o handler de
    // origem, e não a resposta deste envio. Mantido igual no piloto.
    async publishFormSubmitted(formId) {
      try {
        const form = await prisma.form.findUnique({
          where: { id: formId },
          select: {
            organizationId: true,
            formSubmissions: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true, leadId: true },
            },
          },
        });
        const latestResponse = form?.formSubmissions?.[0];
        if (!form || !latestResponse) return;

        await eventBus.publish("form.submitted", {
          formId,
          responseId: latestResponse.id,
          leadId: latestResponse.leadId ?? null,
          orgId: form.organizationId,
        });
      } catch (publishError) {
        console.error(`${LOG_PREFIX} eventBus publish falhou:`, publishError);
      }
    },

    async generateActions({ form, response }) {
      try {
        await generateActionsForResponse({
          form: {
            id: form.id,
            userId: form.userId,
            organizationId: form.organizationId,
            name: form.name,
            jsonBlock: form.jsonBlock,
            trackingId: form.settings?.trackingId ?? null,
          },
          formResponse: response,
          config: form.settings?.generateActionsConfig,
        });
      } catch (generationError) {
        console.error(`${LOG_PREFIX} geração de actions falhou:`, generationError);
      }
    },

    async notifyOnboarding(formId) {
      try {
        const onboardingProcess = await prisma.clientOnboardingProcess.findFirst({
          where: { OR: [{ brandFormId: formId }, { onboardingFormId: formId }] },
          select: { id: true, brandFormId: true },
        });
        if (!onboardingProcess) return;

        await inngest.send({
          name: "onboarding/form.submitted",
          data: {
            formId,
            onboardingProcessId: onboardingProcess.id,
            isBrandForm: onboardingProcess.brandFormId === formId,
          },
        });
      } catch (onboardingError) {
        console.error(`${LOG_PREFIX} Inngest send error:`, onboardingError);
      }
    },

    async sendWhatsappNotification({ form, trackingId, lead }) {
      try {
        await inngest.send({
          name: "form/whatsapp.send",
          data: {
            formId: form.id,
            formName: form.name,
            trackingId,
            whatsappChats: form.settings?.whatsappChats ?? [],
            whatsappMessage: form.settings?.whatsappMessage ?? null,
            leadData: lead,
          },
        });
      } catch (whatsappError) {
        console.error(`${LOG_PREFIX} Inngest whatsapp send error:`, whatsappError);
      }
    },
  };
}

export function createPlatformDraftEffects(prisma: AppPrismaClient): DraftEffects {
  return {
    syncFormLabelsToLead(leadId) {
      syncFormLabelsToLeadDescription(prisma, leadId).catch(() => {});
    },

    async publishLeadCreated(createdLead) {
      await publishLeadCreated({ ...createdLead, source: "form" });
    },

    async recordFormStarted({ leadId, formId, responseId }) {
      try {
        await recordLeadEvent({
          leadId,
          eventType: "FORM_STARTED",
          metadata: { formId, formResponseId: responseId, source: "public" },
        });
      } catch (recordError) {
        console.warn("[form/savePartial] FORM_STARTED record failed", recordError);
      }
    },
  };
}
