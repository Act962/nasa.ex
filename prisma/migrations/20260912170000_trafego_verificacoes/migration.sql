-- trafeGO (spec 0009, Fase B-1): verificações do wizard — WhatsApp por código,
-- conta do Instagram/Facebook e número na API Oficial.
-- Só adições: colunas nullable. Nada existente muda.

ALTER TABLE "trafego_pending_purchase" ADD COLUMN "phone_verified_at" TIMESTAMP(3);
ALTER TABLE "trafego_pending_purchase" ADD COLUMN "social_handle" TEXT;
ALTER TABLE "trafego_pending_purchase" ADD COLUMN "social_profile" JSONB;
ALTER TABLE "trafego_pending_purchase" ADD COLUMN "has_official_number" BOOLEAN;
ALTER TABLE "trafego_pending_purchase" ADD COLUMN "official_number" TEXT;
ALTER TABLE "trafego_pending_purchase" ADD COLUMN "official_number_check" JSONB;

ALTER TABLE "trafego_order" ADD COLUMN "phone_verified_at" TIMESTAMP(3);
ALTER TABLE "trafego_order" ADD COLUMN "social_handle" TEXT;
ALTER TABLE "trafego_order" ADD COLUMN "social_profile" JSONB;
ALTER TABLE "trafego_order" ADD COLUMN "has_official_number" BOOLEAN;
ALTER TABLE "trafego_order" ADD COLUMN "official_number" TEXT;
ALTER TABLE "trafego_order" ADD COLUMN "official_number_check" JSONB;

ALTER TABLE "trafego_settings" ADD COLUMN "whatsapp_otp_template" TEXT;
