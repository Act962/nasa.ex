-- Migration: 20260406130000_admin_notifications
-- Applied via: prisma migrate resolve --applied (tables already exist via db push)

-- CreateTable
CREATE TABLE "user_sidebar_preference" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "item_key" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_sidebar_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "app_key" TEXT,
    "action_url" TEXT,
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "sent_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notification_preference" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "notif_type" TEXT NOT NULL,
    "in_app" BOOLEAN NOT NULL DEFAULT true,
    "whats_app" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_notification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "targetType" TEXT NOT NULL DEFAULT 'all',
    "target_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_notification_read" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_notification_read_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_asset" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_sidebar_preference_user_id_idx" ON "user_sidebar_preference"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sidebar_preference_user_id_item_key_key" ON "user_sidebar_preference"("user_id", "item_key");

-- CreateIndex
CREATE INDEX "user_notification_user_id_is_read_idx" ON "user_notification"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "user_notification_user_id_created_at_idx" ON "user_notification"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "user_notification_organization_id_idx" ON "user_notification"("organization_id");

-- CreateIndex
CREATE INDEX "user_notification_preference_user_id_idx" ON "user_notification_preference"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_notification_preference_user_id_organization_id_notif__key" ON "user_notification_preference"("user_id", "organization_id", "notif_type");

-- CreateIndex
CREATE INDEX "admin_notification_targetType_idx" ON "admin_notification"("targetType");

-- CreateIndex
CREATE INDEX "admin_notification_created_at_idx" ON "admin_notification"("created_at");

-- CreateIndex
CREATE INDEX "admin_notification_read_user_id_idx" ON "admin_notification_read"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_notification_read_notification_id_user_id_key" ON "admin_notification_read"("notification_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_asset_key_key" ON "platform_asset"("key");

-- AddForeignKey
ALTER TABLE "user_sidebar_preference" ADD CONSTRAINT "user_sidebar_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification_preference" ADD CONSTRAINT "user_notification_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notification_read" ADD CONSTRAINT "admin_notification_read_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "admin_notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add new columns to "user"
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_system_admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMP(3);

-- AlterTable: add new column to "member"
ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "cargo" TEXT;
