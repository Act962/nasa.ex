-- Endereço do lead (spec 0034): aba "Endereço" dos detalhes do lead.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "address_zip_code" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "address_street" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "address_number" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "address_complement" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "address_neighborhood" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "address_city" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "address_state" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "address_country" TEXT;
