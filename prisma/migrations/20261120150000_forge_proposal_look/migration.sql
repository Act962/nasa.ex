-- Spec 0150: visual da proposta com modelos prontos, cores da empresa e ordem das seções.
ALTER TABLE "forge_settings"
  ADD COLUMN "proposal_template" TEXT NOT NULL DEFAULT 'modern',
  ADD COLUMN "brand_color" TEXT,
  ADD COLUMN "accent_color" TEXT,
  ADD COLUMN "proposal_sections" JSONB,
  ADD COLUMN "payment_methods" JSONB,
  ADD COLUMN "commercial_terms" TEXT;

-- D-4: quem tinha fundo colorido na proposta passa a ter essa cor como cor da marca.
UPDATE "forge_settings"
SET "brand_color" = lower("proposal_bg_color")
WHERE "proposal_bg_color" ~* '^#[0-9a-f]{6}$'
  AND lower("proposal_bg_color") NOT IN ('#ffffff', '#fffffe', '#fefefe');
