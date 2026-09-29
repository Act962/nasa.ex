import "server-only";
import prisma from "@/lib/prisma";

/**
 * Conhecimento da organização para o prompt (spec 0028, RF-13).
 *
 * O material é Markdown escrito ou enviado pela org e entra INTEIRO no prompt —
 * sem chunk, sem embedding, sem pgvector. Para o volume de uma empresa (um
 * punhado de páginas) isso cabe no contexto, é legível na tela e não erra o
 * trecho. Quando o material não couber mais, aí sim vale busca semântica.
 */

/** Teto por documento e no total, para o prompt não estourar nem custar caro. */
export const KNOWLEDGE_DOC_MAX_CHARS = 20_000;
export const KNOWLEDGE_TOTAL_MAX_CHARS = 60_000;

export interface KnowledgeDocument {
  id: string;
  name: string;
  content: string;
}

export async function loadKnowledgeDocuments(params: {
  organizationId: string;
  /** Restringe a um subconjunto (ex.: as bases escolhidas num site do ASTRO CHAT). */
  knowledgeIds?: string[];
}): Promise<KnowledgeDocument[]> {
  const documents = await prisma.aiKnowledge.findMany({
    where: {
      organizationId: params.organizationId,
      status: "READY",
      content: { not: null },
      ...(params.knowledgeIds?.length ? { id: { in: params.knowledgeIds } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, content: true },
  });

  const selected: KnowledgeDocument[] = [];
  let total = 0;
  for (const document of documents) {
    const content = (document.content ?? "").slice(0, KNOWLEDGE_DOC_MAX_CHARS).trim();
    if (!content) continue;
    if (total + content.length > KNOWLEDGE_TOTAL_MAX_CHARS) break;
    total += content.length;
    selected.push({ id: document.id, name: document.name, content });
  }
  return selected;
}

/** Bloco pronto para o prompt. Vazio quando a org não escreveu nada. */
export function buildKnowledgeBlock(documents: KnowledgeDocument[]): string {
  if (documents.length === 0) return "";
  const body = documents
    .map((document) => `## ${document.name}\n${document.content}`)
    .join("\n\n");
  return `\n\n# Conhecimento da empresa\nUse como fonte; não invente além disto.\n\n${body}`;
}
