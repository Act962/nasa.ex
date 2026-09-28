/**
 * Vocabulário visual dos estados de resposta, compartilhado pelos dialogs de
 * formulários do lead e da tarefa.
 *
 * Difere de `form-response-state.ts` (que deriva o estado server-side) por
 * incluir `unfilled`: um formulário na pauta sem nenhuma resposta não tem
 * estado derivado, mas precisa de rótulo e cor na UI.
 */

export const STATE_COLORS: Record<string, string> = {
  empty: "#94a3b8", // slate-400 — iniciado sem resposta
  in_progress: "#3b82f6", // blue
  waiting_client_signature: "#f59e0b", // amber
  stale: "#ef4444", // red
  complete: "#10b981", // emerald
  unfilled: "#6b7280", // gray — form sem nenhuma resposta vinculada
};

export const STATE_LABELS: Record<string, string> = {
  empty: "Iniciado",
  in_progress: "Em preenchimento",
  waiting_client_signature: "Aguardando assinatura",
  stale: "Atrasado",
  complete: "Preenchido",
  unfilled: "Sem preenchimento",
};

/** Ordena do mais urgente pro resolvido — não preenchidos primeiro (CTA). */
export const STATE_SORT_ORDER: Record<string, number> = {
  unfilled: 0,
  empty: 1,
  in_progress: 2,
  waiting_client_signature: 3,
  stale: 4,
  complete: 5,
};
