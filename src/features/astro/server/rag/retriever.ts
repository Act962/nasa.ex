import "server-only";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { embed } from "./embeddings";

export interface RetrievedChunk {
  id: string;
  content: string;
  knowledgeId: string;
  knowledgeName: string;
  distance: number; // cosine distance — menor = mais similar
}

/**
 * Busca semântica nos chunks de uma organização.
 *
 * Por que `$queryRaw`:
 *   - Prisma não tem suporte nativo a tipo `vector` (pgvector). A coluna
 *     `embedding` é declarada via SQL manual, então precisamos de raw SQL para
 *     o operador `<=>` (cosine distance).
 *   - Filtros (`organizationId`, `knowledgeIds`) são interpolados com
 *     `Prisma.sql` para evitar SQL injection.
 *
 * @param organizationId  Sempre obrigatório — multi-tenant guard.
 * @param query           Texto natural; será embeddado.
 * @param knowledgeIds    Restringe a um subconjunto (ex: KB selecionadas no
 *                        AiAgentConfig do agente). Vazio = todas da org.
 * @param topK            Quantos chunks retornar (default 5).
 */
export async function searchKnowledge(opts: {
  organizationId: string;
  query: string;
  knowledgeIds?: string[];
  topK?: number;
}): Promise<RetrievedChunk[]> {
  const { organizationId, query, knowledgeIds, topK = 5 } = opts;

  const queryVector = await embed(query);
  const vectorLiteral = `[${queryVector.join(",")}]`;

  const knowledgeFilter =
    knowledgeIds && knowledgeIds.length > 0
      ? Prisma.sql`AND c.knowledge_id IN (${Prisma.join(knowledgeIds)})`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      content: string;
      knowledge_id: string;
      knowledge_name: string;
      distance: number;
    }>
  >(Prisma.sql`
    SELECT
      c.id,
      c.content,
      c.knowledge_id,
      k.name AS knowledge_name,
      (c.embedding <=> ${vectorLiteral}::vector) AS distance
    FROM ai_knowledge_chunk c
    JOIN ai_knowledge k ON k.id = c.knowledge_id
    WHERE c.organization_id = ${organizationId}
      AND c.embedding IS NOT NULL
      AND k.status = 'READY'
      ${knowledgeFilter}
    ORDER BY c.embedding <=> ${vectorLiteral}::vector
    LIMIT ${topK}
  `);

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    knowledgeId: r.knowledge_id,
    knowledgeName: r.knowledge_name,
    distance: Number(r.distance),
  }));
}
