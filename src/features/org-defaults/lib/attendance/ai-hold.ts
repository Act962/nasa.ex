// Regras puras de quando a IA fala no atendimento (spec 0113, revisão 9.1). Sem banco: o gatilho da IA e o
// estado de atendimento usam as mesmas regras, e `scripts/attendance-ai-hold-check.ts` confere os critérios.
import type { AttendanceSettings } from "@/features/tracking-chat-ai/lib/capabilities";
import type { SectionState } from "./section";

const MINUTE_MS = 60_000;

/** A IA assumiu nesta espera e nenhum humano falou depois. */
export function hasAiTakenOver(state: SectionState): boolean {
  const { aiStepInAt, lastHumanAt } = state;
  return Boolean(aiStepInAt && (!lastHumanAt || aiStepInAt > lastHumanAt));
}

/** Um atendente está na conversa: falou nesta seção e a IA não assumiu depois dele. */
export function isHumanInConversation(state: SectionState): boolean {
  return Boolean(state.lastHumanAt) && !hasAiTakenOver(state);
}

/** O cliente pediu humano (ou a IA transferiu) e ninguém, nem a IA de volta, assumiu ainda. */
export function isHandoffWaiting(state: SectionState): boolean {
  return Boolean(state.humanRequestedAt) && !state.aiStepInAt;
}

/**
 * Troca de verdade (RF-9): nesta seção um humano ou a IA já falou com o cliente. Mensagem fixa, de fluxo, de
 * campanha ou de inatividade não conta, porque só humano e IA marcam a seção. No "Equipe primeiro" só o
 * atendente conta: a IA segura o cliente, mas ele segue esperando a equipe.
 */
export function hasCompanyTalked(state: SectionState, settings: AttendanceSettings): boolean {
  if (settings.firstResponder === "TEAM") return Boolean(state.lastHumanAt);
  return Boolean(state.lastHumanAt || state.lastAiReplyAt);
}

/** Pessoa da equipe falou há menos de `minutes` (revisão 9.1): a IA fica calada nessa conversa. */
export function isHumanReplyRecent(lastHumanReplyAt: Date | string | null | undefined, now: Date, minutes: number): boolean {
  if (!lastHumanReplyAt) return false;
  return now.getTime() - new Date(lastHumanReplyAt).getTime() < minutes * MINUTE_MS;
}

/**
 * Regra da seção que segura a IA numa mensagem do cliente: esperando consultor, ou "Equipe primeiro" antes de
 * a equipe falar e antes de a IA assumir. Pura, para o gatilho da IA e para a conferência de regras.
 */
export function isAiHeldBySection(state: SectionState, settings: AttendanceSettings): boolean {
  if (isHandoffWaiting(state)) return true;
  return settings.firstResponder === "TEAM" && !hasCompanyTalked(state, settings) && !hasAiTakenOver(state);
}
