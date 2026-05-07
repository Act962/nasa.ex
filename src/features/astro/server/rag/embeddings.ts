import "server-only";
import { OpenAIEmbeddings } from "@langchain/openai";

/**
 * Embeddings para o RAG do ASTRO.
 *
 * Usamos `text-embedding-3-small` (1536 dim) — barato e suficiente para a base
 * de conhecimento da organização. A dimensão **deve** bater com a coluna
 * `vector(1536)` em `ai_knowledge_chunk` (vide migration `20260507120000_astro_agents`).
 */
const EMBEDDING_MODEL =
  process.env.ASTRO_EMBEDDING_MODEL ?? "text-embedding-3-small";

let cached: OpenAIEmbeddings | null = null;

export function getEmbeddings(): OpenAIEmbeddings {
  if (cached) return cached;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY ausente — necessária para gerar embeddings do ASTRO RAG.",
    );
  }
  cached = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: EMBEDDING_MODEL,
    dimensions: 1536,
  });
  return cached;
}

export async function embed(text: string): Promise<number[]> {
  return getEmbeddings().embedQuery(text);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return getEmbeddings().embedDocuments(texts);
}
