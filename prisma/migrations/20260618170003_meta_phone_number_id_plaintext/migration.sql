-- Meta Cloud API: stop encrypting public identifiers.
--
-- `metaPhoneNumberId` is the lookup key used by the official webhook
-- (`/api/chat/webhook/official`) to route incoming events to the right
-- WhatsAppInstance. It was being encrypted with AES-256-GCM + random IV,
-- which made `where: { metaPhoneNumberId: <plaintext> }` impossible and
-- forced an O(N) scan + decrypt loop on every cold-miss POST.
--
-- The field is NOT a secret: it ships in every webhook payload
-- (`entry[].changes[].value.metadata.phone_number_id`) and in the Graph
-- send URL (`POST /v23.0/{phone_number_id}/messages`). Same goes for
-- `metaBusinessAccountId` (the `entry[].id` in webhooks).
--
-- This migration:
--   1. Wipes any leftover ciphertext from META_CLOUD instances (the
--      integration is not in production yet — dev rows get re-saved via
--      the UI in plaintext).
--   2. Adds a UNIQUE index on `meta_phone_number_id` so the webhook can
--      `findUnique` in sub-millisecond time, with no scan, no decrypt
--      loop, and no in-process cache layer.

-- Step 1: clear all Meta credentials from existing META_CLOUD instances.
-- Safe because the integration is pre-production; operators will re-save
-- credentials via the UI in plaintext after deploy.
UPDATE "whatsapp_instances"
SET
  "meta_access_token" = NULL,
  "meta_phone_number_id" = NULL,
  "meta_app_secret" = NULL,
  "meta_verify_token" = NULL,
  "meta_business_account_id" = NULL
WHERE "provider" = 'META_CLOUD';

-- Step 2: enforce uniqueness on the lookup key. Postgres allows multiple
-- NULLs in a UNIQUE column, so UAZAPI instances (where the column is
-- always NULL) coexist freely.
CREATE UNIQUE INDEX "whatsapp_instances_meta_phone_number_id_key"
  ON "whatsapp_instances"("meta_phone_number_id");
