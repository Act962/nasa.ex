-- Disparo em Massa self-service (spec 0040).
ALTER TABLE "whatsapp_instances" ADD COLUMN IF NOT EXISTS "meta_business_id" TEXT;

CREATE TABLE IF NOT EXISTS "broadcast_fee_payments" (
  "id" TEXT NOT NULL,
  "broadcast_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "recipients" INTEGER NOT NULL,
  "template_category" TEXT NOT NULL,
  "meta_cost_brl_cents" INTEGER NOT NULL,
  "fee_percent" INTEGER NOT NULL,
  "service_fee_brl_cents" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "external_id" TEXT,
  "checkout_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "dispatch_mode" TEXT NOT NULL DEFAULT 'NOW',
  "scheduled_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "broadcast_fee_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "broadcast_fee_payments_broadcast_id_status_idx" ON "broadcast_fee_payments"("broadcast_id", "status");
CREATE INDEX IF NOT EXISTS "broadcast_fee_payments_organization_id_idx" ON "broadcast_fee_payments"("organization_id");
DO $$ BEGIN
  ALTER TABLE "broadcast_fee_payments" ADD CONSTRAINT "broadcast_fee_payments_broadcast_id_fkey"
    FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "broadcast_fee_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "tiers" JSONB NOT NULL,
  "min_fee_brl_cents" INTEGER NOT NULL DEFAULT 1990,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "broadcast_fee_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "salvy_virtual_numbers" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "tracking_id" TEXT,
  "created_by_id" TEXT NOT NULL,
  "salvy_id" TEXT NOT NULL,
  "phone_number" TEXT NOT NULL,
  "area_code" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "next_charge_at" TIMESTAMP(3),
  "canceled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "salvy_virtual_numbers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "salvy_virtual_numbers_salvy_id_key" ON "salvy_virtual_numbers"("salvy_id");
CREATE INDEX IF NOT EXISTS "salvy_virtual_numbers_organization_id_idx" ON "salvy_virtual_numbers"("organization_id");
CREATE INDEX IF NOT EXISTS "salvy_virtual_numbers_status_next_charge_at_idx" ON "salvy_virtual_numbers"("status", "next_charge_at");
