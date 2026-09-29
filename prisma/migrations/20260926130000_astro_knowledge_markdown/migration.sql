-- Spec: specs/astro/0028-astro-commander.md (RF-13)
--
-- Base de conhecimento em Markdown: o texto vive na linha, entra inteiro no
-- prompt e é editável na tela. Sem pgvector, sem chunk, sem embedding.
--
-- ESTRITAMENTE ADITIVA: uma coluna opcional. ROLLBACK:
--   ALTER TABLE "ai_knowledge" DROP COLUMN "content";

ALTER TABLE "ai_knowledge" ADD COLUMN "content" TEXT;
