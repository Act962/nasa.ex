-- Spec 0053: escolha da IA do ASTRO por organização (null = ainda não escolheu).
CREATE TYPE "AstroAiMode" AS ENUM ('PLATFORM', 'OWN');

ALTER TABLE "organization" ADD COLUMN "astro_ai_mode" "AstroAiMode";
