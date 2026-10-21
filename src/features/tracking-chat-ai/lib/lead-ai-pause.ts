// Pausa da IA por lead (`Lead.isActive = false`). Decisão temporária de 2026-10: a IA liga e desliga só para o
// funil inteiro (Configurações → Chatbot IA, `Tracking.globalAiActive`). Enquanto estiver `false`, o botão por lead
// some, nada grava a pausa e a IA ignora a que já existe. Para voltar à pausa por lead, troque para `true`.
// Os envios dos fluxos no Modo Agente não dependem disto: eles nunca respeitam a pausa da IA.
export const IS_LEAD_AI_PAUSE_ENABLED = false;

export function isLeadAiPaused(lead: { isActive: boolean }): boolean {
  return IS_LEAD_AI_PAUSE_ENABLED && !lead.isActive;
}
