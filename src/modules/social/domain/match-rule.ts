import { normalizeText } from "./text-normalizer";
import type {
  MatchRule,
  SocialMatchLogicValue,
  SocialMatchOperatorValue,
} from "./types";

export type MatchOutcome = {
  matched: boolean;
  /** Termos que casaram — alimenta o desempate por especificidade (RF-12). */
  matchedTerms: string[];
  /** Termo de exclusão que vetou o disparo, quando houver. */
  excludedBy?: string;
};

const NO_MATCH: MatchOutcome = { matched: false, matchedTerms: [] };

function termMatches(
  operator: SocialMatchOperatorValue,
  normalizedText: string,
  normalizedTerm: string,
): boolean {
  if (operator === "ANY_TEXT") return true;
  if (!normalizedTerm) return false;
  switch (operator) {
    case "CONTAINS":
      return normalizedText.includes(normalizedTerm);
    case "EXACT":
      return normalizedText === normalizedTerm;
    case "STARTS_WITH":
      return normalizedText.startsWith(normalizedTerm);
    default:
      return false;
  }
}

function ruleMatches(rule: MatchRule, normalizedText: string): string[] {
  if (rule.operator === "ANY_TEXT") return ["*"];
  const hits: string[] = [];
  for (const term of rule.terms) {
    const normalizedTerm = normalizeText(term);
    if (termMatches(rule.operator, normalizedText, normalizedTerm)) {
      hits.push(normalizedTerm);
    }
  }
  return hits;
}

/**
 * Avalia as regras de um gatilho contra o texto recebido.
 *
 * Ordem deliberada: **exclusão vence sempre**. Um comentário que contém
 * "preço" e "golpe" não dispara, mesmo com "preço" na lista de inclusão
 * (spec 0024 CA-7).
 *
 * Ausência de regra `INCLUDE` é lida como "qualquer texto" (RF-10) — é assim
 * que o modo "qualquer comentário" do ManyChat cai no mesmo caminho de código.
 */
export function evaluateRules(
  rules: readonly MatchRule[],
  logic: SocialMatchLogicValue,
  rawText: string,
): MatchOutcome {
  const normalizedText = normalizeText(rawText);

  for (const rule of rules) {
    if (rule.kind !== "EXCLUDE") continue;
    const hits = ruleMatches(rule, normalizedText);
    if (hits.length > 0) {
      return { matched: false, matchedTerms: [], excludedBy: hits[0] };
    }
  }

  const includeRules = rules.filter((rule) => rule.kind === "INCLUDE");
  if (includeRules.length === 0) {
    return { matched: true, matchedTerms: [] };
  }

  const matchedTerms: string[] = [];
  let satisfiedRules = 0;

  for (const rule of includeRules) {
    const hits = ruleMatches(rule, normalizedText);
    if (hits.length > 0) {
      satisfiedRules += 1;
      matchedTerms.push(...hits);
    }
  }

  const matched =
    logic === "ALL_RULES"
      ? satisfiedRules === includeRules.length
      : satisfiedRules > 0;

  return matched ? { matched, matchedTerms } : NO_MATCH;
}
