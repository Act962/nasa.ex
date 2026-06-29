-- CreateTable
CREATE TABLE "ai_button_preset" (
    "id" TEXT NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "footer_text" TEXT,
    "buttons" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_button_preset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_button_preset_tracking_id_idx" ON "ai_button_preset"("tracking_id");

-- AddForeignKey
ALTER TABLE "ai_button_preset" ADD CONSTRAINT "ai_button_preset_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
