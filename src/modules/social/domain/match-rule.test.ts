import { describe, expect, it } from "vitest";
import { evaluateRules } from "./match-rule";
import { normalizeText } from "./text-normalizer";
import type { MatchRule } from "./types";

let ruleSequence = 0;

function rule(
  kind: MatchRule["kind"],
  operator: MatchRule["operator"],
  terms: string[] = [],
): MatchRule {
  ruleSequence += 1;
  return { id: `rule-${ruleSequence}`, kind, operator, terms };
}

describe("normalizeText", () => {
  it("RF-11: minúsculas, sem acento e com espaços colapsados", () => {
    expect(normalizeText("  PROMOÇÃO   Relâmpago\n")).toBe("promocao relampago");
  });
});

describe("evaluateRules", () => {
  it("RF-10: sem regra de inclusão, qualquer texto casa", () => {
    expect(evaluateRules([], "ANY_RULE", "oi")).toEqual({ matched: true, matchedTerms: [] });
  });

  it("RF-11: casa ignorando acento e caixa, e devolve o termo normalizado", () => {
    const outcome = evaluateRules(
      [rule("INCLUDE", "CONTAINS", ["Preço"])],
      "ANY_RULE",
      "Qual o PRECO?",
    );

    expect(outcome).toEqual({ matched: true, matchedTerms: ["preco"] });
  });

  it("CA-7: exclusão vence mesmo com termo de inclusão presente", () => {
    const outcome = evaluateRules(
      [rule("INCLUDE", "CONTAINS", ["preço"]), rule("EXCLUDE", "CONTAINS", ["golpe"])],
      "ANY_RULE",
      "isso de preço é golpe",
    );

    expect(outcome).toEqual({ matched: false, matchedTerms: [], excludedBy: "golpe" });
  });

  it("só com regras de exclusão, casa quando nenhuma delas bate", () => {
    const rules = [rule("EXCLUDE", "CONTAINS", ["golpe"])];

    expect(evaluateRules(rules, "ANY_RULE", "quero comprar").matched).toBe(true);
    expect(evaluateRules(rules, "ANY_RULE", "golpe").matched).toBe(false);
  });

  it("EXACT exige o texto inteiro e STARTS_WITH o começo", () => {
    const exact = [rule("INCLUDE", "EXACT", ["quero"])];
    const startsWith = [rule("INCLUDE", "STARTS_WITH", ["quero"])];

    expect(evaluateRules(exact, "ANY_RULE", " Quero ").matched).toBe(true);
    expect(evaluateRules(exact, "ANY_RULE", "quero muito").matched).toBe(false);
    expect(evaluateRules(startsWith, "ANY_RULE", "quero muito").matched).toBe(true);
    expect(evaluateRules(startsWith, "ANY_RULE", "eu quero").matched).toBe(false);
  });

  it("ANY_RULE basta uma regra satisfeita; ALL_RULES exige todas", () => {
    const rules = [rule("INCLUDE", "CONTAINS", ["preço"]), rule("INCLUDE", "CONTAINS", ["frete"])];

    expect(evaluateRules(rules, "ANY_RULE", "qual o preço?")).toEqual({
      matched: true,
      matchedTerms: ["preco"],
    });
    expect(evaluateRules(rules, "ALL_RULES", "qual o preço?")).toEqual({
      matched: false,
      matchedTerms: [],
    });
    expect(evaluateRules(rules, "ALL_RULES", "preço e frete?")).toEqual({
      matched: true,
      matchedTerms: ["preco", "frete"],
    });
  });

  it("uma regra com vários termos devolve todos os que casaram", () => {
    const outcome = evaluateRules(
      [rule("INCLUDE", "CONTAINS", ["preço", "valor", "frete"])],
      "ANY_RULE",
      "preço e frete",
    );

    expect(outcome.matchedTerms).toEqual(["preco", "frete"]);
  });

  it("ANY_TEXT casa qualquer texto e conta como um termo genérico", () => {
    const outcome = evaluateRules([rule("INCLUDE", "ANY_TEXT")], "ANY_RULE", "");

    expect(outcome).toEqual({ matched: true, matchedTerms: ["*"] });
  });

  it("termo vazio não casa nada", () => {
    const outcome = evaluateRules([rule("INCLUDE", "CONTAINS", ["", "   "])], "ANY_RULE", "oi");

    expect(outcome.matched).toBe(false);
  });
});
