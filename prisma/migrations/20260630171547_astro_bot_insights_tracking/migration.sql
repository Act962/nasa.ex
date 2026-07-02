-- AlterTable
ALTER TABLE "user_whatsapp_binding" ALTER COLUMN "pin_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "astro_bot_tracking" (
    "id" TEXT NOT NULL,
    "bot_config_id" TEXT NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "astro_bot_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "astro_bot_tracking_tracking_id_idx" ON "astro_bot_tracking"("tracking_id");

-- CreateIndex
CREATE UNIQUE INDEX "astro_bot_tracking_bot_config_id_tracking_id_key" ON "astro_bot_tracking"("bot_config_id", "tracking_id");

-- AddForeignKey
ALTER TABLE "astro_bot_tracking" ADD CONSTRAINT "astro_bot_tracking_bot_config_id_fkey" FOREIGN KEY ("bot_config_id") REFERENCES "organization_bot_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astro_bot_tracking" ADD CONSTRAINT "astro_bot_tracking_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
