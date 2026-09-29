import "server-only";
import type { AstroFieldStep } from "../types";

// Passos e deduções dos verbos de funil (spec 0033, RF-9).

export const NEW_NAME_STEP: AstroFieldStep = {
  title: "Novo nome",
  question: "Qual o novo nome?",
  picker: { kind: "text", placeholder: "Novo nome", maxLength: 80 },
};

/** O que vem depois de "funil"/"coluna"… até "para", "no funil", "com" ou o fim. */
export function extractNamedThing(text: string, nouns: string, stopWords = "para|pra|no funil|na coluna|do funil|com"): string | undefined {
  const match = text.match(
    new RegExp(`\\b(?:${nouns})\\s+(?:chamad[oa]\\s+|de\\s+)?["“]?(.+?)["”]?(?=\\s+(?:${stopWords})\\b|[,.!?]|$)`, "iu"),
  );
  const value = match?.[1]?.trim();
  return value && value.length >= 2 ? value : undefined;
}

/** "… para Fechamento" → o novo nome. */
export function extractNewName(text: string): string | undefined {
  const value = text.match(/\b(?:para|pra)\s+["“]?(.+?)["”]?[.!?]*$/iu)?.[1]?.trim();
  return value && value.length >= 2 ? value : undefined;
}
