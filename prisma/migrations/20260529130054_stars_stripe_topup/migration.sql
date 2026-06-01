-- AlterTable
ALTER TABLE "stars_payment" ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "refunded_at" TIMESTAMP(3),
ADD COLUMN     "stripe_payment_intent_id" TEXT,
ALTER COLUMN "package_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "processed_stripe_event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'stars',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_stripe_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stars_payment_stripe_payment_intent_id_idx" ON "stars_payment"("stripe_payment_intent_id");
