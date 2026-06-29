/*
  Warnings:

  - A unique constraint covering the columns `[stripe_checkout_session_id]` on the table `nasa_route_enrollment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "nasa_route_course" ADD COLUMN     "is_free" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "price_brl_cents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "nasa_route_enrollment" ADD COLUMN     "paid_brl_cents" INTEGER,
ADD COLUMN     "stripe_checkout_session_id" TEXT,
ADD COLUMN     "stripe_payment_intent_id" TEXT;

-- AlterTable
ALTER TABLE "nasa_route_plan" ADD COLUMN     "price_brl_cents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "pending_course_purchase" ADD COLUMN     "flow" TEXT NOT NULL DEFAULT 'public',
ADD COLUMN     "user_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "nasa_route_enrollment_stripe_checkout_session_id_key" ON "nasa_route_enrollment"("stripe_checkout_session_id");

-- CreateIndex
CREATE INDEX "pending_course_purchase_user_id_idx" ON "pending_course_purchase"("user_id");

-- AddForeignKey
ALTER TABLE "pending_course_purchase" ADD CONSTRAINT "pending_course_purchase_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
