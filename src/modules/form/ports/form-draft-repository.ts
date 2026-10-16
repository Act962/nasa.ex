import type { TenantScope } from "@/modules/shared/domain/tenant-scope";
import type { BoardPosition, LeadIdentity } from "../domain/submission";

export type OpenDraft = {
  id: string;
  leadId: string | null;
  labelManuallyEdited: boolean;
  formJsonBlock: unknown;
};

export type DraftForm = {
  id: string;
  jsonBlock: unknown;
  target: BoardPosition | null;
};

/**
 * Rascunho do formulário público, salvo a cada "Próximo". `findPublishedForm`
 * é a leitura sem escopo de onde o `TenantScope` nasce.
 */
export interface FormDraftRepository {
  /** Rascunho deste formulário ainda não concluído. */
  findOpenDraft(formId: string, responseId: string): Promise<OpenDraft | null>;
  updateDraft(draftId: string, changes: { jsonResponse: string; label?: string | null }): Promise<void>;
  findPublishedForm(formId: string): Promise<{ form: DraftForm; tenant: TenantScope } | null>;
  /** Lead com o telefone, preferindo o que já está no tracking do formulário. */
  findLeadIdByPhone(tenant: TenantScope, phone: string, trackingId: string): Promise<string | null>;
  createLead(input: { identity: LeadIdentity; target: BoardPosition; origin: unknown }): Promise<string>;
  /** Cria o rascunho e soma 1 no contador do formulário, na mesma transação. */
  createDraft(
    formId: string,
    content: { jsonResponse: string; leadId: string | null; label: string | null },
  ): Promise<{ id: string; leadId: string | null }>;
}
