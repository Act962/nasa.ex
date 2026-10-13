import "server-only";
import { systemClock } from "@/modules/shared/infra";
import {
  submitFormResponse,
  type SubmitFormResponseInput,
  type SubmitFormResponseResult,
} from "./application/submit-form-response";
import { formSubmissionRepository, submissionEffects } from "./infra/production-adapters";

/**
 * Composition root do módulo `form`. É o único arquivo que instancia adapter:
 * `application/` e `domain/` recebem tudo por parâmetro.
 */

export { FORM_NOT_PUBLISHED } from "./domain/errors";
export type { SubmitFormResponseInput, SubmitFormResponseResult };

/** Envio de resposta pelo formulário público, com os adapters de produção. */
export function submitPublicFormResponse(input: SubmitFormResponseInput): Promise<SubmitFormResponseResult> {
  return submitFormResponse(input, {
    submissions: formSubmissionRepository,
    effects: submissionEffects,
    clock: systemClock,
  });
}

/**
 * Liga o envio pelo módulo no lugar do handler de origem (passo 7d do plano de
 * migração). Lida em tempo de execução: desligar não exige novo build.
 */
export function isFormSubmitModuleOn(): boolean {
  return process.env.FORM_SUBMIT_USE_MODULE === "true";
}
