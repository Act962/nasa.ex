-- Migration: add_app_display_fields
-- Adds display metadata fields to app_star_costs table for public marketplace listing

ALTER TABLE "app_star_costs"
  ADD COLUMN IF NOT EXISTS "display_name" TEXT,
  ADD COLUMN IF NOT EXISTS "description"  TEXT,
  ADD COLUMN IF NOT EXISTS "category"     TEXT,
  ADD COLUMN IF NOT EXISTS "icon_emoji"   TEXT,
  ADD COLUMN IF NOT EXISTS "is_public"    BOOLEAN NOT NULL DEFAULT true;
