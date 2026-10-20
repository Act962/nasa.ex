import { DomainError } from "@/modules/shared/domain/domain-error";

export const FORM_NOT_PUBLISHED = "FORM_NOT_PUBLISHED";

/** Formulário inexistente ou despublicado: para quem responde, os dois são "não encontrado". */
export class FormNotPublishedError extends DomainError {
  constructor(formId: string) {
    super(FORM_NOT_PUBLISHED, "Formulário não encontrado ou não publicado", { formId });
    this.name = "FormNotPublishedError";
  }
}

export const DRAFT_NOT_OPEN = "DRAFT_NOT_OPEN";

/** Rascunho inexistente, de outro formulário ou já concluído: não aceita mais salvamento. */
export class DraftNotOpenError extends DomainError {
  constructor(responseId: string) {
    super(DRAFT_NOT_OPEN, "Resposta não encontrada", { responseId });
    this.name = "DraftNotOpenError";
  }
}
