import { shouldLogUtmLanding, type TrackingParams } from "@/lib/tracking/tracking-params";
import type { Clock } from "@/modules/shared/ports";
import { deriveResponseLabel } from "../domain/derive-response-label";
import { FormNotPublishedError } from "../domain/errors";
import { extractResponseTagIds } from "../domain/response-tags";
import {
  didLeadChangePosition,
  readLeadIdentity,
  responseMilestoneAction,
  type BoardPosition,
  type LeadContact,
  type LeadPlacement,
  type ResponseMilestoneAction,
} from "../domain/submission";
import type {
  FormSubmissionRepository,
  PublishedForm,
  RecordedSubmission,
  SubmissionStore,
} from "../ports/form-submission-repository";
import type {
  LeadJourneyEvent,
  LeadMove,
  LeadStatusChange,
  LeadTimelineEvent,
  SubmissionEffects,
} from "../ports/submission-effects";

/**
 * Envio de uma resposta de formulário público (specs 0001, 0002, 0100 e 0109).
 *
 * Duas fases, e a separação é a regra 18 do projeto: `persistSubmission` só
 * grava, dentro de uma transação, e devolve o que precisa acontecer depois;
 * `runPostCommitEffects` executa esses efeitos com a resposta já gravada.
 */

export type SubmitFormResponseInput = {
  formId: string;
  response: string;
  tracking?: TrackingParams;
  /** Tag escolhida na ação do botão "Próximo". */
  nextActionTagId?: string | null;
  /** Rascunho do salvamento parcial que este envio conclui. */
  finalizingResponseId?: string | null;
};

export type SubmitFormResponseResult = {
  id: string;
  message: "Response submitted" | "Response already submitted";
  lead: LeadContact | null;
};

export type SubmitFormResponseDependencies = {
  submissions: FormSubmissionRepository;
  effects: SubmissionEffects;
  clock: Clock;
};

type PersistedSubmission = {
  form: PublishedForm;
  lead: LeadContact | null;
  leadEvents: LeadTimelineEvent[];
  journeyEvents: LeadJourneyEvent[];
  createdLead: (BoardPosition & { leadId: string }) | null;
  movedLead: LeadMove | null;
  statusChange: LeadStatusChange | null;
  responseId: string | null;
  responseLeadId: string | null;
  milestone: { formOwnerId: string; organizationId: string; action: ResponseMilestoneAction } | null;
};

export async function submitFormResponse(
  input: SubmitFormResponseInput,
  dependencies: SubmitFormResponseDependencies,
): Promise<SubmitFormResponseResult> {
  const { submissions, effects, clock } = dependencies;

  // Sessão retomada ou nova tentativa cujo retorno se perdeu: a resposta já
  // foi processada, então devolve o mesmo lead sem repetir efeito nenhum.
  if (input.finalizingResponseId) {
    const completed = await submissions.findCompletedSubmission(input.formId, input.finalizingResponseId);
    if (completed) {
      return { id: input.formId, message: "Response already submitted", lead: completed.lead };
    }
  }

  const answerTagIds = extractResponseTagIds(input.response);
  const persisted = await submissions.transaction((store) =>
    persistSubmission(store, input, answerTagIds, clock),
  );
  await runPostCommitEffects(persisted, input, answerTagIds, effects, clock);

  return { id: input.formId, message: "Response submitted", lead: persisted.lead };
}

async function persistSubmission(
  store: SubmissionStore,
  input: SubmitFormResponseInput,
  answerTagIds: readonly string[],
  clock: Clock,
): Promise<PersistedSubmission> {
  const found = await store.findPublishedForm(input.formId);
  if (!found) throw new FormNotPublishedError(input.formId);
  const { form, tenant } = found;

  const identity = readLeadIdentity(input.response);
  const existingTagIds = await store.findExistingTagIds(tenant, answerTagIds);
  const target = formTarget(form);

  const leadEvents: LeadTimelineEvent[] = [];
  const journeyEvents: LeadJourneyEvent[] = [];
  const submitFlags: { returning?: boolean; finalized?: true } = {};
  let lead: LeadContact | null = null;
  let createdLead: PersistedSubmission["createdLead"] = null;
  let movedLead: LeadMove | null = null;
  let statusChange: LeadStatusChange | null = null;

  const collectPositionChange = (placement: LeadPlacement) => {
    if (!didLeadChangePosition(placement)) return;
    const fromStatusId = placement.from?.statusId ?? null;
    movedLead = {
      leadId: placement.lead.id,
      fromTrackingId: placement.from?.trackingId ?? null,
      toTrackingId: placement.to.trackingId,
      fromStatusId,
      toStatusId: placement.to.statusId,
    };
    statusChange = {
      leadId: placement.lead.id,
      fromStatusId,
      toStatusId: placement.to.statusId,
      orgId: form.organizationId,
      responsibleId: placement.lead.responsibleId,
    };
    leadEvents.push({
      leadId: placement.lead.id,
      eventType: "STATUS_CHANGE",
      previousStatusId: fromStatusId,
      newStatusId: placement.to.statusId,
      metadata: { source: "form_submit" },
    });
  };

  // Rascunho obsoleto (apagado ou de outro formulário) não derruba o envio:
  // segue como envio novo.
  const draft = input.finalizingResponseId
    ? await store.findOpenDraft(input.formId, input.finalizingResponseId)
    : null;

  if (draft) {
    const draftLead = draft.leadId ? await store.findLeadContact(draft.leadId) : null;
    if (draftLead) {
      lead = draftLead;
      // O salvamento parcial não aplica tags; as das respostas entram aqui.
      if (existingTagIds.length > 0) await store.attachTagsToLead(draftLead.id, existingTagIds);
      submitFlags.finalized = true;
      if (target) {
        const placement = await store.placeKnownLead(draftLead.id, target);
        if (placement) collectPositionChange(placement);
      }
    }
  } else if (target) {
    const placement = await store.resolveAndPlaceLead(tenant, { identity, target, origin: input.tracking });
    const isNewLead = placement.outcome === "created";

    // Contato que já existia sem e-mail guarda o informado no formulário (spec 0100, RF-11).
    const filledEmail = !isNewLead && !placement.lead.email?.trim() && identity.email ? identity.email : null;
    if (filledEmail) await store.setLeadEmail(placement.lead.id, filledEmail);

    lead = {
      id: placement.lead.id,
      name: placement.lead.name,
      email: filledEmail ?? placement.lead.email,
      phone: placement.lead.phone,
      publicToken: placement.lead.publicToken,
    };
    if (existingTagIds.length > 0) await store.attachTagsToLead(placement.lead.id, existingTagIds);
    submitFlags.returning = !isNewLead;

    if (isNewLead) {
      createdLead = { leadId: placement.lead.id, ...target };
      if (shouldLogUtmLanding(input.tracking)) {
        journeyEvents.push({
          leadId: placement.lead.id,
          kind: "utm_landing",
          metadata: {
            utmSource: input.tracking?.utmSource,
            utmMedium: input.tracking?.utmMedium,
            utmCampaign: input.tracking?.utmCampaign,
            utmContent: input.tracking?.utmContent,
            utmTerm: input.tracking?.utmTerm,
            landingPage: input.tracking?.landingPage,
            referrer: input.tracking?.referrer,
          },
        });
      }
    } else {
      collectPositionChange(placement);
    }
  }

  const leadId = lead?.id ?? null;
  const content = {
    jsonResponse: input.response,
    label: deriveResponseLabel({ jsonBlock: form.jsonBlock, jsonResponse: input.response }),
    completedAt: clock.now(),
  };
  const recorded: RecordedSubmission = draft
    ? await store.finalizeDraft(input.formId, draft.id, content)
    : await store.createSubmission(input.formId, { ...content, leadId });

  if (lead && leadId) {
    leadEvents.push({
      leadId,
      eventType: "FORM_SUBMITTED",
      metadata: {
        ...(recorded.responseId ? { formResponseId: recorded.responseId } : {}),
        formId: input.formId,
        label: recorded.label,
        ...submitFlags,
      },
    });

    if (input.nextActionTagId && (await store.attachTagToLeadIfExists(tenant, leadId, input.nextActionTagId))) {
      leadEvents.push({
        leadId,
        eventType: "TAG_ADDED",
        metadata: { tagId: input.nextActionTagId, source: "form_next_button" },
      });
    }

    if (!lead.publicToken) {
      lead = { ...lead, publicToken: await store.findLeadPublicToken(leadId) };
    }
  }

  const milestoneAction = responseMilestoneAction(recorded.responseCount);

  return {
    form,
    lead,
    leadEvents,
    journeyEvents,
    createdLead,
    movedLead,
    statusChange,
    responseId: recorded.responseId,
    responseLeadId: leadId,
    milestone: milestoneAction
      ? { formOwnerId: recorded.formOwnerId, organizationId: recorded.organizationId, action: milestoneAction }
      : null,
  };
}

function formTarget(form: PublishedForm): BoardPosition | null {
  const { trackingId, statusId } = form.settings ?? {};
  return trackingId && statusId ? { trackingId, statusId } : null;
}

async function runPostCommitEffects(
  persisted: PersistedSubmission,
  input: SubmitFormResponseInput,
  answerTagIds: readonly string[],
  effects: SubmissionEffects,
  clock: Clock,
): Promise<void> {
  const { form, lead, leadEvents, journeyEvents, createdLead, movedLead, statusChange, milestone } = persisted;

  if (milestone) await effects.awardResponseMilestone({ formId: input.formId, ...milestone });
  if (leadEvents.length > 0) await effects.recordLeadEvents(leadEvents);
  if (journeyEvents.length > 0) await effects.trackJourneyEvents(journeyEvents);

  // Tags das respostas disparam os fluxos "Lead com Tag" (spec 0100, RF-2).
  if (lead) await effects.dispatchAnswerTagFlows({ leadId: lead.id, answerTagIds });

  if (createdLead) {
    await effects.publishLeadCreated(createdLead);
    await effects.startNewLeadWorkflow({ leadId: createdLead.leadId, trackingId: createdLead.trackingId });
  }
  if (movedLead) await effects.publishLeadMoved({ ...movedLead, movedAt: clock.now().toISOString() });
  if (statusChange) await effects.publishLeadStatusChanged(statusChange);

  effects.syncFormLabelsToLead(leadEvents[0]?.leadId ?? null);
  await effects.logSubmissionActivity(input.formId);
  await effects.publishFormSubmitted(input.formId);

  if (persisted.responseId && form.settings?.generateActionsConfig) {
    await effects.generateActions({
      form,
      response: { id: persisted.responseId, jsonResponse: input.response, leadId: persisted.responseLeadId },
    });
  }

  await effects.notifyOnboarding(input.formId);

  const whatsappChats = form.settings?.whatsappChats ?? [];
  const trackingId = form.settings?.trackingId;
  if (whatsappChats.length > 0 && trackingId) {
    await effects.sendWhatsappNotification({
      form,
      trackingId,
      lead: {
        id: lead?.id ?? null,
        name: lead?.name ?? null,
        phone: lead?.phone ?? null,
        email: lead?.email ?? null,
      },
    });
  }
}
