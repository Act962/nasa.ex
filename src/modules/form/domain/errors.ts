import { DomainError } from "@/modules/shared/domain/domain-error";

export const FORM_NOT_PUBLISHED = "FORM_NOT_PUBLISHED";

/** Formulário inexistente ou despublicado: para quem responde, os dois são "não encontrado". */
export class FormNotPublishedError extends DomainError {
  constructor(formId: string) {
    super(FORM_NOT_PUBLISHED, "Formulário não encontrado ou não publicado", { formId });
    this.name = "FormNotPublishedError";
  }
}
