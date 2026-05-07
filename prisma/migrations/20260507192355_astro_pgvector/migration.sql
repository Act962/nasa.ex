-- ASTRO RAG: pgvector setup
--
-- A migration anterior (20260507192354_astro_agents) foi gerada via
-- `prisma migrate dev` e cria as 4 tabelas (ai_agent_config, ai_session,
-- ai_knowledge, ai_knowledge_chunk). Mas o Prisma NÃO conhece o tipo
-- `vector` do pgvector — então a coluna `embedding` em ai_knowledge_chunk
-- precisa ser declarada e indexada via SQL puro, aqui.
--
-- Em produção: rodar como qualquer outra migration (`prisma migrate deploy`).
-- Localmente, se a migration anterior já foi aplicada e esta ainda não:
--   pnpm prisma db execute --file prisma/migrations/20260507192355_astro_pgvector/migration.sql --schema prisma/schema.prisma
--   pnpm prisma migrate resolve --applied "20260507192355_astro_pgvector"

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "ai_knowledge_chunk"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

CREATE INDEX IF NOT EXISTS "ai_knowledge_chunk_embedding_idx"
  ON "ai_knowledge_chunk"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
