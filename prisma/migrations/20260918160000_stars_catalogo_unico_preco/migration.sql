-- Spec: specs/stars/0020-catalogo-unico-de-preco-e-ponto-unico-de-cobranca.md
--
-- Catálogo único de preço de Stars: a tabela de preço passa a suportar cobrança
-- por quantidade (token, MB, segundo, imagem, mensagem) e por variante
-- (modelo/provider), e a tabela de regras por organização ganha a marcação de
-- sobrescrita.
--
-- ESTRITAMENTE ADITIVA (RNF-2 da spec 0020): nenhum DROP, nenhum RENAME, nenhuma
-- coluna NOT NULL sem DEFAULT. Nenhuma linha de saldo ou de extrato é tocada.
--
-- ROLLBACK:
--   As colunas são todas novas e opcionais. Reverter o código faz o sistema
--   voltar a ler apenas `monthly_cost`, e estas colunas ficam ociosas sem
--   quebrar nada — não é necessário desfazer a migration.
--   Se ainda assim for preciso desfazer:
--     ALTER TABLE "app_star_costs"
--       DROP COLUMN "unit", DROP COLUMN "unit_cost", DROP COLUMN "unit_divisor",
--       DROP COLUMN "min_charge", DROP COLUMN "max_charge",
--       DROP COLUMN "variant_costs", DROP COLUMN "variant_mode",
--       DROP COLUMN "allow_bonus", DROP COLUMN "is_enabled",
--       DROP COLUMN "expected_cost_usd";
--     ALTER TABLE "star_rule" DROP COLUMN "is_override";
--   Isso não causa perda de dado de saldo; perde-se apenas a configuração de
--   preço por quantidade/variante que tiver sido cadastrada.

-- ── Cobrança por quantidade ──────────────────────────────────────────────────
ALTER TABLE "app_star_costs" ADD COLUMN "unit" TEXT;
ALTER TABLE "app_star_costs" ADD COLUMN "unit_cost" DECIMAL(12,6);
ALTER TABLE "app_star_costs" ADD COLUMN "unit_divisor" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "app_star_costs" ADD COLUMN "min_charge" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "app_star_costs" ADD COLUMN "max_charge" INTEGER;

-- ── Preço por variante (modelo / provider) ───────────────────────────────────
ALTER TABLE "app_star_costs" ADD COLUMN "variant_costs" JSONB;
ALTER TABLE "app_star_costs" ADD COLUMN "variant_mode" TEXT;

-- ── Controle de cobrança ─────────────────────────────────────────────────────
ALTER TABLE "app_star_costs" ADD COLUMN "allow_bonus" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "app_star_costs" ADD COLUMN "is_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "app_star_costs" ADD COLUMN "expected_cost_usd" DECIMAL(14,8);

-- ── Sobrescrita de preço por organização ─────────────────────────────────────
-- Default `false` de propósito: as linhas já existentes continuam sem efeito
-- sobre o preço, para não alterar cobrança em silêncio (D-4 da spec 0020).
ALTER TABLE "star_rule" ADD COLUMN "is_override" BOOLEAN NOT NULL DEFAULT false;
