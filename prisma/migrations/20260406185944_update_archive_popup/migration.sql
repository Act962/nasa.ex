-- CreateTable
CREATE TABLE "achievement_popup_template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#7a1fe7',
    "accentColor" TEXT NOT NULL DEFAULT '#a855f7',
    "backgroundColor" TEXT NOT NULL DEFAULT '#1a0a3d',
    "textColor" TEXT NOT NULL DEFAULT '#ffffff',
    "iconUrl" TEXT,
    "enableConfetti" BOOLEAN NOT NULL DEFAULT true,
    "enableSound" BOOLEAN NOT NULL DEFAULT true,
    "dismissDuration" INTEGER NOT NULL DEFAULT 5000,
    "customJson" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievement_popup_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "achievement_popup_template_type_idx" ON "achievement_popup_template"("type");
