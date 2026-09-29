-- Spec: specs/astro/0031-astro-chat-widget-no-site.md
--
-- ASTRO CHAT: widget do ASTRO no site do cliente.
--
-- ESTRITAMENTE ADITIVA: um valor novo no enum LeadSource e duas tabelas novas.
-- Nenhum DROP, nenhum RENAME, nenhuma linha existente reescrita.
--
-- ROLLBACK:
--   Reverter o código basta. Para desfazer de fato:
--     DROP TABLE "astro_chat_visitors";
--     DROP TABLE "astro_chat_sites";
--   (O valor ASTRO_CHAT do enum LeadSource não pode ser removido sem recriar o
--   tipo; deixá-lo não afeta nada.)

ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'ASTRO_CHAT' BEFORE 'OTHER';

CREATE TABLE "astro_chat_sites" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tracking_id" TEXT,
    "status_id" TEXT,
    "name" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "allowed_origins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "paused_reason" TEXT,
    "ai_enabled" BOOLEAN NOT NULL DEFAULT true,
    "assistant_name" TEXT NOT NULL DEFAULT 'Astro',
    "greeting" TEXT NOT NULL DEFAULT 'Oi! Eu sou o Astro. Posso te ajudar?',
    "instructions" TEXT,
    "knowledge_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accent_color" TEXT NOT NULL DEFAULT '#7C3AED',
    "position" TEXT NOT NULL DEFAULT 'right',
    "privacy_url" TEXT,
    "daily_ai_reply_limit" INTEGER NOT NULL DEFAULT 300,
    "ai_replies_day" DATE,
    "ai_replies_count" INTEGER NOT NULL DEFAULT 0,
    "next_billing_at" TIMESTAMP(3),
    "last_billed_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astro_chat_sites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "astro_chat_visitors" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_hash" TEXT,
    "origin" TEXT,
    "page_url" TEXT,
    "lead_id" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "astro_chat_visitors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "astro_chat_sites_public_key_key" ON "astro_chat_sites"("public_key");
CREATE INDEX "astro_chat_sites_organization_id_idx" ON "astro_chat_sites"("organization_id");
CREATE INDEX "astro_chat_sites_next_billing_at_idx" ON "astro_chat_sites"("next_billing_at");
CREATE UNIQUE INDEX "astro_chat_visitors_token_hash_key" ON "astro_chat_visitors"("token_hash");
CREATE INDEX "astro_chat_visitors_site_id_created_at_idx" ON "astro_chat_visitors"("site_id", "created_at");
CREATE INDEX "astro_chat_visitors_ip_hash_created_at_idx" ON "astro_chat_visitors"("ip_hash", "created_at");
CREATE INDEX "astro_chat_visitors_lead_id_idx" ON "astro_chat_visitors"("lead_id");

ALTER TABLE "astro_chat_sites" ADD CONSTRAINT "astro_chat_sites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "astro_chat_sites" ADD CONSTRAINT "astro_chat_sites_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "astro_chat_visitors" ADD CONSTRAINT "astro_chat_visitors_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "astro_chat_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "astro_chat_visitors" ADD CONSTRAINT "astro_chat_visitors_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
