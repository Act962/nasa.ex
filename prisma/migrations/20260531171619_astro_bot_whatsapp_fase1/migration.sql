-- Migration: Astro Bot via WhatsApp — Fase 1 (MVP read-only)
--
-- Cria:
--   - enum BotProvider (UAZAPI default + META_CLOUD futuro)
--   - organization_bot_config (1:1 com organization)
--   - user_whatsapp_binding (N:1 com user/org, com PIN+sessão)
--   - whatsapp_bot_command (log + rate limit + audit)
--
-- Doc completo: docs/astro-bot-whatsapp.md

CREATE TYPE "BotProvider" AS ENUM ('UAZAPI', 'META_CLOUD');

-- ─── organization_bot_config ────────────────────────────────
CREATE TABLE "organization_bot_config" (
  "id"                    TEXT NOT NULL,
  "organization_id"       TEXT NOT NULL,
  "provider"              "BotProvider" NOT NULL DEFAULT 'UAZAPI',
  "uazapi_instance_id"    TEXT,
  "meta_phone_id"         TEXT,
  "meta_access_token"     TEXT,
  "meta_waba_id"          TEXT,
  "max_phones_per_org"    INTEGER NOT NULL DEFAULT 3,
  "max_cmds_per_hour"     INTEGER NOT NULL DEFAULT 30,
  "quiet_hours_start"     INTEGER,
  "quiet_hours_end"       INTEGER,
  "is_active"             BOOLEAN NOT NULL DEFAULT false,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_bot_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_bot_config_organization_id_key"
  ON "organization_bot_config"("organization_id");
CREATE INDEX "organization_bot_config_organization_id_idx"
  ON "organization_bot_config"("organization_id");
CREATE INDEX "organization_bot_config_uazapi_instance_id_idx"
  ON "organization_bot_config"("uazapi_instance_id");

ALTER TABLE "organization_bot_config"
  ADD CONSTRAINT "organization_bot_config_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_bot_config"
  ADD CONSTRAINT "organization_bot_config_uazapi_instance_id_fkey"
  FOREIGN KEY ("uazapi_instance_id") REFERENCES "whatsapp_instances"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── user_whatsapp_binding ──────────────────────────────────
CREATE TABLE "user_whatsapp_binding" (
  "id"                         TEXT NOT NULL,
  "user_id"                    TEXT NOT NULL,
  "organization_id"            TEXT NOT NULL,
  "organization_bot_config_id" TEXT NOT NULL,
  "phone_e164"                 TEXT NOT NULL,
  "verified_at"                TIMESTAMP(3),
  "pin_hash"                   TEXT NOT NULL,
  "pin_failures"               INTEGER NOT NULL DEFAULT 0,
  "pin_locked_until"           TIMESTAMP(3),
  "session_token"              TEXT,
  "session_expires_at"         TIMESTAMP(3),
  "session_device_id"          TEXT,
  "allowed_tools"              TEXT[] DEFAULT ARRAY[]::TEXT[],
  "is_active"                  BOOLEAN NOT NULL DEFAULT true,
  "last_seen_at"               TIMESTAMP(3),
  "created_at"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                 TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_whatsapp_binding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_whatsapp_binding_phone_e164_key"
  ON "user_whatsapp_binding"("phone_e164");
CREATE INDEX "user_whatsapp_binding_user_id_idx"
  ON "user_whatsapp_binding"("user_id");
CREATE INDEX "user_whatsapp_binding_organization_id_idx"
  ON "user_whatsapp_binding"("organization_id");
CREATE INDEX "user_whatsapp_binding_phone_e164_idx"
  ON "user_whatsapp_binding"("phone_e164");
CREATE INDEX "user_whatsapp_binding_organization_bot_config_id_idx"
  ON "user_whatsapp_binding"("organization_bot_config_id");

ALTER TABLE "user_whatsapp_binding"
  ADD CONSTRAINT "user_whatsapp_binding_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_whatsapp_binding"
  ADD CONSTRAINT "user_whatsapp_binding_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_whatsapp_binding"
  ADD CONSTRAINT "user_whatsapp_binding_organization_bot_config_id_fkey"
  FOREIGN KEY ("organization_bot_config_id") REFERENCES "organization_bot_config"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── whatsapp_bot_command ───────────────────────────────────
CREATE TABLE "whatsapp_bot_command" (
  "id"                TEXT NOT NULL,
  "binding_id"        TEXT NOT NULL,
  "organization_id"   TEXT NOT NULL,
  "received_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "message_text"      TEXT NOT NULL,
  "response_summary"  TEXT,
  "status"            TEXT NOT NULL DEFAULT 'ok',
  "tools_called"      TEXT[] DEFAULT ARRAY[]::TEXT[],
  "tokens_used"       INTEGER,
  "stars_charged"     INTEGER,
  CONSTRAINT "whatsapp_bot_command_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whatsapp_bot_command_binding_id_received_at_idx"
  ON "whatsapp_bot_command"("binding_id", "received_at");
CREATE INDEX "whatsapp_bot_command_organization_id_received_at_idx"
  ON "whatsapp_bot_command"("organization_id", "received_at");
CREATE INDEX "whatsapp_bot_command_status_idx"
  ON "whatsapp_bot_command"("status");

ALTER TABLE "whatsapp_bot_command"
  ADD CONSTRAINT "whatsapp_bot_command_binding_id_fkey"
  FOREIGN KEY ("binding_id") REFERENCES "user_whatsapp_binding"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
