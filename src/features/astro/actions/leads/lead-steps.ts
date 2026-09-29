import "server-only";
import type { AstroFieldStep } from "../types";

// Passos e deduções que os verbos de Tracking compartilham (spec 0033, RF-9).
// Deduzir da frase em código é o que deixa o roteiro sem tokens: o que o
// código não achar vira o seletor daquele campo, não pergunta aberta.

export const LEAD_FIELD_STEP: AstroFieldStep = {
  title: "Qual lead?",
  question: "Busque o lead pelo nome ou telefone.",
  picker: { kind: "entity", entity: "lead", placeholder: "Buscar lead por nome ou telefone" },
};

export const TRACKING_FIELD_STEP: AstroFieldStep = {
  title: "Em qual funil?",
  question: "Escolha o funil.",
  picker: { kind: "entity", entity: "tracking", placeholder: "Buscar funil" },
};

export function normalizeIntent(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const PHONE_PATTERN = /(?:\+?55\s*)?\(?\d{2}\)?\s*9?\s*\d{4}[-\s]?\d{4}/;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PROPER_NAME = "[A-ZÀ-Ý][\\wÀ-ÿ]+(?:\\s+(?:de|da|do|dos|das)?\\s*[A-ZÀ-Ý][\\wÀ-ÿ]+)*";

export function extractPhone(text: string): string | undefined {
  return text.match(PHONE_PATTERN)?.[0];
}

export function extractEmail(text: string): string | undefined {
  return text.match(EMAIL_PATTERN)?.[0];
}

/** Nome próprio logo depois de uma das preposições ("da Maria Clara", "no Kauê"). */
export function extractNameAfter(text: string, prepositions: string[]): string | undefined {
  // Só a palavra de entrada ignora maiúscula ("Adiciona o Vendedor"); o nome
  // continua exigindo inicial maiúscula, que é o que o separa do resto da frase.
  const leadingWords = prepositions.flatMap((word) => [word, word.charAt(0).toUpperCase() + word.slice(1)]);
  const pattern = new RegExp(
    `\\b(?:${leadingWords.join("|")})\\s+(?:(?:o|a)\\s+)?(?:lead\\s+|cliente\\s+)?(${PROPER_NAME})`,
    "u",
  );
  return text.match(pattern)?.[1];
}

/** "no funil Vendas", "no tracking Pós-venda". */
export function extractTrackingName(text: string): string | undefined {
  // Sem a flag "i": a continuação do nome exige inicial maiúscula.
  return text.match(/\b(?:no|na)\s+(?:[Ff]unil|[Tt]racking)\s+([^\s,.;]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ]+)*)/u)?.[1];
}

/** "pular", "sem telefone", "não tem" — o usuário dispensou um campo opcional. */
export function isSkipAnswer(value: string): boolean {
  return /^(pular|pula|sem|nenhum|nao tem|sem telefone|sem e-?mail|depois)$/.test(
    normalizeIntent(value.trim()).replace(/[.!]+$/, ""),
  );
}
