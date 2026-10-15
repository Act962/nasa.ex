import type { TenantScope } from "@/modules/shared/domain/tenant-scope";
import type { BoardPosition, LeadContact, LeadIdentity, LeadPlacement } from "../domain/submission";

export type PublishedFormSettings = {
  trackingId: string | null;
  statusId: string | null;
  /** Conversas de WhatsApp avisadas a cada envio. O módulo só transporta. */
  whatsappChats: readonly unknown[];
  whatsappMessage: string | null;
  /** Valor cru de `FormSettings.generateActionsConfig`. */
  generateActionsConfig: unknown;
};

export type PublishedForm = {
  id: string;
  userId: string;
  name: string;
  jsonBlock: unknown;
  organizationId: string;
  settings: PublishedFormSettings | null;
};

export type SubmissionContent = {
  jsonResponse: string;
  label: string | null;
  completedAt: Date;
};

/** Estado do formulário logo depois de gravar a resposta. */
export type RecordedSubmission = {
  responseId: string | null;
  label: string | null;
  responseCount: number;
  formOwnerId: string;
  organizationId: string;
};

/**
 * Leituras e escritas do envio dentro de UMA transação. Só banco: efeito de
 * rede ou helper com outra conexão fica em `SubmissionEffects` (regra 18).
 *
 * `findPublishedForm` é a leitura sem escopo de onde o `TenantScope` nasce: o
 * envio é público e a empresa é a dona do formulário. As operações por id de
 * lead ainda não conferem a empresa, como no código de origem.
 */
export interface SubmissionStore {
  findPublishedForm(formId: string): Promise<{ form: PublishedForm; tenant: TenantScope } | null>;
  /** Só tags da empresa: o id vem da resposta pública (spec 0111). */
  findExistingTagIds(tenant: TenantScope, tagIds: readonly string[]): Promise<string[]>;
  /** Rascunho deste formulário ainda não concluído. */
  findOpenDraft(formId: string, responseId: string): Promise<{ id: string; leadId: string | null } | null>;
  findLeadContact(leadId: string): Promise<LeadContact | null>;
  attachTagsToLead(leadId: string, tagIds: readonly string[]): Promise<void>;
  /** Anexa a tag se ela existir na empresa. Devolve se anexou. */
  attachTagToLeadIfExists(tenant: TenantScope, leadId: string, tagId: string): Promise<boolean>;
  placeKnownLead(leadId: string, target: BoardPosition): Promise<LeadPlacement | null>;
  /** Acha a pessoa pelo telefone na empresa e a posiciona, ou cria o lead. */
  resolveAndPlaceLead(
    tenant: TenantScope,
    input: { identity: LeadIdentity; target: BoardPosition; origin: unknown },
  ): Promise<LeadPlacement>;
  setLeadEmail(leadId: string, email: string): Promise<void>;
  findLeadPublicToken(leadId: string): Promise<string | null>;
  /** Conclui o rascunho. Não soma no contador: o salvamento parcial já somou. */
  finalizeDraft(formId: string, draftId: string, content: SubmissionContent): Promise<RecordedSubmission>;
  createSubmission(
    formId: string,
    content: SubmissionContent & { leadId: string | null },
  ): Promise<RecordedSubmission>;
}

export interface FormSubmissionRepository {
  /** Resposta já concluída: o reenvio responde com o mesmo lead, sem reprocessar. */
  findCompletedSubmission(formId: string, responseId: string): Promise<{ lead: LeadContact | null } | null>;
  transaction<TResult>(work: (store: SubmissionStore) => Promise<TResult>): Promise<TResult>;
}
