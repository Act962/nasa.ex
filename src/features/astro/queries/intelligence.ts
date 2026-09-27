import "server-only";
import { loadKnowledgeDocuments } from "@/features/astro/server/knowledge/load-knowledge";
import { loadActiveMemories } from "@/features/astro/server/knowledge/load-memories";
import type { AstroQuery } from "./types";

// Perguntas sobre a própria empresa — regra ativa ou trecho do documento de
// conhecimento — respondidas em código. "Posso dar 20% de desconto?" custava
// ~23 mil tokens no orquestrador, e em 2 de 6 vezes ele respondia com a
// recusa de exclusão. A regra já está escrita: basta devolvê-la.

const QUESTION = /\?\s*$|^(posso|pode|podemos|qual|quais|quanto|quando|como|tem|existe|e permitido|voces)\b/;

const STOPWORDS = new Set([
  "para", "pelo", "pela", "sobre", "qual", "quais", "quanto", "quando", "como", "posso",
  "pode", "podemos", "voces", "nosso", "nossa", "dele", "dela", "esse", "essa", "este",
  "esta", "isso", "cliente", "empresa", "fazer", "tenho", "temos", "existe", "sem", "com",
]);

const MIN_WORD_LENGTH = 4;

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= MIN_WORD_LENGTH && !STOPWORDS.has(word)),
  );
}

function sharedWords(first: Set<string>, second: Set<string>): string[] {
  return [...first].filter((word) => second.has(word));
}

const companyRule: AstroQuery = {
  key: "intelligence.rule",
  app: "astro",
  appKey: "astro",
  matches: (text) => QUESTION.test(text),
  run: async ({ ctx, text }) => {
    const questionWords = significantWords(text);
    const memories = await loadActiveMemories({ organizationId: ctx.organizationId });
    const [bestRule] = memories
      .map((memory) => ({ memory, overlap: sharedWords(questionWords, significantWords(memory.content)) }))
      .filter((scored) => scored.overlap.length > 0)
      .sort((first, second) => second.overlap.length - first.overlap.length);
    if (!bestRule) return null;
    return { text: `Pela regra da empresa: ${bestRule.memory.content}` };
  },
};

interface KnowledgeSection {
  heading: string;
  body: string;
}

function splitSections(content: string): KnowledgeSection[] {
  return content
    .split(/\n(?=#{1,3}\s)/)
    .map((chunk) => {
      const [firstLine, ...rest] = chunk.split("\n");
      return { heading: firstLine.replace(/^#{1,3}\s*/, "").trim(), body: rest.join("\n").trim() };
    })
    .filter((section) => section.heading && section.body);
}

const knowledgeSection: AstroQuery = {
  key: "intelligence.knowledge",
  app: "astro",
  appKey: "astro",
  matches: (text) => QUESTION.test(text),
  run: async ({ ctx, text }) => {
    const questionWords = significantWords(text);
    const documents = await loadKnowledgeDocuments({ organizationId: ctx.organizationId });
    // A seção só responde se a pergunta citar o assunto do título dela —
    // "prazo da proposta da Maria" não pode virar o prazo de implantação.
    const [bestSection] = documents
      .flatMap((document) => splitSections(document.content))
      .map((section) => ({
        section,
        headingOverlap: sharedWords(questionWords, significantWords(section.heading)).length,
        bodyOverlap: sharedWords(questionWords, significantWords(section.body)).length,
      }))
      .filter((scored) => scored.headingOverlap > 0)
      .sort(
        (first, second) =>
          second.headingOverlap + second.bodyOverlap - (first.headingOverlap + first.bodyOverlap),
      );
    if (!bestSection) return null;
    return { text: `${bestSection.section.heading}: ${bestSection.section.body}` };
  },
};

/** Por último na ordem: consultas específicas de cada app respondem antes. */
export const INTELLIGENCE_QUERIES: AstroQuery[] = [companyRule, knowledgeSection];
