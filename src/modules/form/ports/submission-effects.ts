import type { BoardPosition, ResponseMilestoneAction } from "../domain/submission";
import type { PublishedForm } from "./form-submission-repository";

export type LeadTimelineEvent = {
  leadId: string;
  eventType: "STATUS_CHANGE" | "FORM_SUBMITTED" | "TAG_ADDED";
  previousStatusId?: string | null;
  newStatusId?: string | null;
  metadata?: Record<string, unknown>;
};

export type LeadJourneyEvent = {
  leadId: string;
  kind: "utm_landing";
  metadata: Record<string, unknown>;
};

export type LeadMove = {
  leadId: string;
  fromTrackingId: string | null;
  toTrackingId: string;
  fromStatusId: string | null;
  toStatusId: string;
};

export type LeadStatusChange = {
  leadId: string;
  fromStatusId: string | null;
  toStatusId: string;
  orgId: string;
  responsibleId: string | null;
};

export type SubmissionLeadSummary = {
  id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
};

/**
 * Tudo que o envio causa depois de gravado: jornada do lead, board ao vivo,
 * fluxos, alertas, pontuação, action gerada e avisos. Roda sempre após o
 * commit. Cada adapter decide se a própria falha é tolerada; o caso de uso só
 * garante a ordem.
 */
export interface SubmissionEffects {
  awardResponseMilestone(input: {
    formId: string;
    formOwnerId: string;
    organizationId: string;
    action: ResponseMilestoneAction;
  }): Promise<void>;
  recordLeadEvents(events: readonly LeadTimelineEvent[]): Promise<void>;
  trackJourneyEvents(events: readonly LeadJourneyEvent[]): Promise<void>;
  dispatchAnswerTagFlows(input: { leadId: string; answerTagIds: readonly string[] }): Promise<void>;
  publishLeadCreated(input: BoardPosition & { leadId: string }): Promise<void>;
  startNewLeadWorkflow(input: { leadId: string; trackingId: string }): Promise<void>;
  publishLeadMoved(move: LeadMove & { movedAt: string }): Promise<void>;
  publishLeadStatusChanged(change: LeadStatusChange): Promise<void>;
  /** Dispara e não espera: o envio não aguarda a descrição do lead ser atualizada. */
  syncFormLabelsToLead(leadId: string | null): void;
  logSubmissionActivity(formId: string): Promise<void>;
  publishFormSubmitted(formId: string): Promise<void>;
  generateActions(input: {
    form: PublishedForm;
    response: { id: string; jsonResponse: string; leadId: string | null };
  }): Promise<void>;
  notifyOnboarding(formId: string): Promise<void>;
  sendWhatsappNotification(input: {
    form: PublishedForm;
    trackingId: string;
    lead: SubmissionLeadSummary;
  }): Promise<void>;
}
