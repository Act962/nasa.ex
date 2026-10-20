import type { TrackingParams } from "@/lib/tracking/tracking-params";
import { deriveResponseLabel } from "../domain/derive-response-label";
import { DraftNotOpenError, FormNotPublishedError } from "../domain/errors";
import { readDraftLeadIdentity } from "../domain/submission";
import type { DraftEffects } from "../ports/draft-effects";
import type { FormDraftRepository } from "../ports/form-draft-repository";

/**
 * Salvamento parcial do formulário público, chamado a cada "Próximo".
 *
 * Sem `responseId`, cria o rascunho, acha ou cria o lead pelo telefone e soma
 * no contador. Com `responseId`, só atualiza as respostas do rascunho em
 * aberto. Mover o lead para a coluna do formulário fica para o envio final.
 */

export type SaveFormDraftInput = {
  formId: string;
  response: string;
  tracking?: TrackingParams;
  responseId?: string | null;
};

export type SaveFormDraftResult = {
  responseId: string;
  leadId: string | null;
  created: boolean;
};

export type SaveFormDraftDependencies = {
  drafts: FormDraftRepository;
  effects: DraftEffects;
};

export async function saveFormDraft(
  input: SaveFormDraftInput,
  { drafts, effects }: SaveFormDraftDependencies,
): Promise<SaveFormDraftResult> {
  if (input.responseId) {
    const draft = await drafts.findOpenDraft(input.formId, input.responseId);
    if (!draft) throw new DraftNotOpenError(input.responseId);

    await drafts.updateDraft(draft.id, {
      jsonResponse: input.response,
      // Título editado à mão não é mais derivado das respostas.
      ...(draft.labelManuallyEdited
        ? {}
        : { label: deriveResponseLabel({ jsonBlock: draft.formJsonBlock, jsonResponse: input.response }) }),
    });
    effects.syncFormLabelsToLead(draft.leadId);

    return { responseId: draft.id, leadId: draft.leadId, created: false };
  }

  const identity = readDraftLeadIdentity(input.response);
  const found = await drafts.findPublishedForm(input.formId);
  if (!found) throw new FormNotPublishedError(input.formId);
  const { form, tenant } = found;

  let leadId: string | null = null;
  let isNewLead = false;
  if (form.target && identity.phone) {
    leadId = await drafts.findLeadIdByPhone(tenant, identity.phone, form.target.trackingId);
  }
  if (!leadId && form.target) {
    leadId = await drafts.createLead({ identity, target: form.target, origin: input.tracking });
    isNewLead = true;
  }

  const draft = await drafts.createDraft(form.id, {
    jsonResponse: input.response,
    leadId,
    label: deriveResponseLabel({ jsonBlock: form.jsonBlock, jsonResponse: input.response }),
  });

  effects.syncFormLabelsToLead(draft.leadId);
  if (isNewLead && leadId && form.target) {
    await effects.publishLeadCreated({ leadId, ...form.target });
  }
  if (draft.leadId) {
    await effects.recordFormStarted({ leadId: draft.leadId, formId: form.id, responseId: draft.id });
  }

  return { responseId: draft.id, leadId: draft.leadId, created: true };
}
