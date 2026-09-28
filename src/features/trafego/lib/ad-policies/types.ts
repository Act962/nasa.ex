import type { TrafegoPlatform } from "@/generated/prisma/enums";

/**
 * OK segue; WARNING paga depois de reconhecer o aviso; BLOCKED não passa pelo
 * checkout automático — precisa de um gestor. A severidade é do PIOR item
 * encontrado, nunca uma média.
 */
export type ComplianceLevel = "OK" | "WARNING" | "BLOCKED";

export interface PolicyRule {
  id: string;
  /** Rótulo curto mostrado ao cliente. */
  label: string;
  /** Por que a plataforma recusa — em português de gente. */
  reason: string;
  /** O que o cliente pode fazer a respeito. */
  fix: string;
  level: Exclude<ComplianceLevel, "OK">;
  /** Vazio = vale para todos os canais. */
  platforms?: TrafegoPlatform[];
  sourceId: string;
  /**
   * Termos que acionam a regra. Casam por palavra inteira, sem acento e sem
   * diferenciar maiúsculas — ver `prescreen.ts`.
   */
  terms: string[];
  /** Expressões com número/prazo, que texto solto não pega. */
  patterns?: RegExp[];
}

export interface PolicyHit {
  ruleId: string;
  label: string;
  reason: string;
  fix: string;
  level: Exclude<ComplianceLevel, "OK">;
  sourceUrl: string;
  /** Trecho do texto do cliente que acionou a regra. */
  excerpt: string;
}

export interface PrescreenResult {
  level: ComplianceLevel;
  hits: PolicyHit[];
}
