import "server-only";
import { systemClock } from "@/modules/shared/infra";
import { saveFormDraft, type SaveFormDraftInput, type SaveFormDraftResult } from "./application/save-form-draft";
import {
  submitFormResponse,
  type SubmitFormResponseInput,
  type SubmitFormResponseResult,
} from "./application/submit-form-response";
import {
  draftEffects,
  formDraftRepository,
  formSubmissionRepository,
  submissionEffects,
} from "./infra/production-adapters";

/**
 * Composition root do módulo `form`. É o único arquivo que instancia adapter:
 * `application/` e `domain/` recebem tudo por parâmetro.
 */

export { DRAFT_NOT_OPEN, FORM_NOT_PUBLISHED } from "./domain/errors";
export type { SaveFormDraftInput, SaveFormDraftResult, SubmitFormResponseInput, SubmitFormResponseResult };

/** Envio de resposta pelo formulário público, com os adapters de produção. */
export function submitPublicFormResponse(input: SubmitFormResponseInput): Promise<SubmitFormResponseResult> {
  return submitFormResponse(input, {
    submissions: formSubmissionRepository,
    effects: submissionEffects,
    clock: systemClock,
  });
}

/** Salvamento parcial do formulário público ("Próximo"), com os adapters de produção. */
export function savePublicFormDraft(input: SaveFormDraftInput): Promise<SaveFormDraftResult> {
  return saveFormDraft(input, { drafts: formDraftRepository, effects: draftEffects });
}

/**
 * O envio e o salvamento parcial rodam pelo módulo por padrão. `FORM_SUBMIT_USE_MODULE=false` volta ao
 * handler de origem, como saída de emergência até o passo 7e. Lida em tempo de execução: não exige novo build.
 */
export function isFormSubmitModuleOn(): boolean {
  return process.env.FORM_SUBMIT_USE_MODULE !== "false";
}
