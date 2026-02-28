-- CreateTable
CREATE TABLE "ai_setting" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "assistant_name" TEXT,
    "finish_sentence" TEXT,
    "is_audio_enabled" BOOLEAN NOT NULL DEFAULT false,
    "trackingId" TEXT NOT NULL,

    CONSTRAINT "ai_setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_setting_trackingId_key" ON "ai_setting"("trackingId");

-- AddForeignKey
ALTER TABLE "ai_setting" ADD CONSTRAINT "ai_setting_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "tracking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
