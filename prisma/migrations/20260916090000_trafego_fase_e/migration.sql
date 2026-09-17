-- trafeGO fase E — alterações estritamente aditivas.

CREATE TYPE "TrafegoTopUpStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED');

ALTER TABLE "trafego_order"
  ADD COLUMN "materials_profile_link" TEXT;

ALTER TABLE "trafego_pending_purchase"
  ADD COLUMN "desired_creative_count" INTEGER;

ALTER TABLE "trafego_settings"
  ADD COLUMN "included_creatives" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "extra_creative_brl_cents" INTEGER NOT NULL DEFAULT 4000;

CREATE TABLE "trafego_creative_topup" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "amount_brl_cents" INTEGER NOT NULL,
  "status" "TrafegoTopUpStatus" NOT NULL DEFAULT 'PENDING',
  "stripe_session_id" TEXT,
  "stripe_payment_intent_id" TEXT,
  "purchased_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paid_at" TIMESTAMP(3),
  CONSTRAINT "trafego_creative_topup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trafego_info_tip_seen" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "tip_key" TEXT NOT NULL,
  "seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trafego_info_tip_seen_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trafego_creative_topup_order_id_idx" ON "trafego_creative_topup"("order_id");
CREATE INDEX "trafego_creative_topup_stripe_session_id_idx" ON "trafego_creative_topup"("stripe_session_id");
CREATE UNIQUE INDEX "trafego_info_tip_seen_user_id_tip_key_key" ON "trafego_info_tip_seen"("user_id", "tip_key");

ALTER TABLE "trafego_creative_topup"
  ADD CONSTRAINT "trafego_creative_topup_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "trafego_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trafego_creative_topup"
  ADD CONSTRAINT "trafego_creative_topup_purchased_by_user_id_fkey"
  FOREIGN KEY ("purchased_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trafego_info_tip_seen"
  ADD CONSTRAINT "trafego_info_tip_seen_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
