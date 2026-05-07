import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { AiKnowledgeStatus } from "@/generated/prisma/enums";

/**
 * Ingest de uma `AiKnowledge` no RAG do ASTRO. STUB — Sessão 3 implementa:
 *   1. Download do `fileUrl` (R2/S3) via fetch.
 *   2. Loader do LangChain por tipo (PDF/DOCX/XLSX/TXT).
 *   3. Split com RecursiveCharacterTextSplitter (chunkSize ~800, overlap ~100).
 *   4. `embedBatch` em lotes de 100 (vide rag/embeddings.ts).
 *   5. INSERT em ai_knowledge_chunk com `embedding = $vector::vector` via $queryRaw.
 *   6. Atualiza chunksCount + status = READY.
 *
 * Por ora apenas marca status para validar que o evento dispara.
 */
export const astroIngestKnowledge = inngest.createFunction(
  { id: "astro-ingest-knowledge", retries: 1 },
  { event: "astro/knowledge.ingest" },
  async ({ event, step }) => {
    const { knowledgeId } = event.data as { knowledgeId: string };

    await step.run("mark-processing", async () => {
      await prisma.aiKnowledge.update({
        where: { id: knowledgeId },
        data: { status: AiKnowledgeStatus.PROCESSING },
      });
    });

    // TODO Sessão 3: download + load + split + embed + upsert.

    await step.run("mark-pending-impl", async () => {
      await prisma.aiKnowledge.update({
        where: { id: knowledgeId },
        data: {
          status: AiKnowledgeStatus.ERROR,
          errorMessage:
            "Ingest ainda não implementado — placeholder Sessão 2.",
        },
      });
    });

    return { knowledgeId, status: "stub" as const };
  },
);
