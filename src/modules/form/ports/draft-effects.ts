import type { BoardPosition } from "../domain/submission";

/** Efeitos do salvamento parcial, todos depois de gravar. */
export interface DraftEffects {
  /** Dispara e não espera. */
  syncFormLabelsToLead(leadId: string | null): void;
  publishLeadCreated(input: BoardPosition & { leadId: string }): Promise<void>;
  recordFormStarted(input: { leadId: string; formId: string; responseId: string }): Promise<void>;
}
