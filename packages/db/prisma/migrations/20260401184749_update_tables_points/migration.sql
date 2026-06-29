-- AlterTable
ALTER TABLE "member" ADD COLUMN     "cargo" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_system_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboarding_completed_at" TIMESTAMP(3);

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
CREATE TABLE "space_point_level" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "required_points" INTEGER NOT NULL,
    "badge_number" INTEGER NOT NULL,
    "planet_emoji" TEXT NOT NULL DEFAULT '🪐',

    CONSTRAINT "space_point_level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_point_rule" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "cooldown_hours" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_point_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_point_ranking_prize" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'monthly',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_point_ranking_prize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_space_point" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "weekly_points" INTEGER NOT NULL DEFAULT 0,
    "week_start" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_space_point_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_point_transaction" (
    "id" TEXT NOT NULL,
    "user_point_id" TEXT NOT NULL,
    "rule_id" TEXT,
    "points" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "space_point_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_space_point_seal" (
    "id" TEXT NOT NULL,
    "user_point_id" TEXT NOT NULL,
    "level_id" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_space_point_seal_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "payment_gateway_config" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT,
    "secretKey" TEXT NOT NULL,
    "publicKey" TEXT,
    "webhookSecret" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_gateway_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stars_payment" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "stars_amount" INTEGER NOT NULL,
    "amount_brl" DECIMAL(65,30) NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "gateway_id" TEXT,

    CONSTRAINT "stars_payment_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "space_point_level_order_key" ON "space_point_level"("order");

-- CreateIndex
CREATE INDEX "space_point_rule_org_id_idx" ON "space_point_rule"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "space_point_rule_org_id_action_key" ON "space_point_rule"("org_id", "action");

-- CreateIndex
CREATE INDEX "space_point_ranking_prize_org_id_idx" ON "space_point_ranking_prize"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "space_point_ranking_prize_org_id_rank_period_key" ON "space_point_ranking_prize"("org_id", "rank", "period");

-- CreateIndex
CREATE INDEX "user_space_point_org_id_total_points_idx" ON "user_space_point"("org_id", "total_points");

-- CreateIndex
CREATE UNIQUE INDEX "user_space_point_user_id_org_id_key" ON "user_space_point"("user_id", "org_id");

-- CreateIndex
CREATE INDEX "space_point_transaction_user_point_id_idx" ON "space_point_transaction"("user_point_id");

-- CreateIndex
CREATE INDEX "space_point_transaction_user_point_id_created_at_idx" ON "space_point_transaction"("user_point_id", "created_at");

-- CreateIndex
CREATE INDEX "user_space_point_seal_user_point_id_idx" ON "user_space_point_seal"("user_point_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_space_point_seal_user_point_id_level_id_key" ON "user_space_point_seal"("user_point_id", "level_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_asset_key_key" ON "platform_asset"("key");

-- CreateIndex
CREATE INDEX "stars_payment_user_id_idx" ON "stars_payment"("user_id");

-- CreateIndex
CREATE INDEX "stars_payment_organization_id_idx" ON "stars_payment"("organization_id");

-- CreateIndex
CREATE INDEX "stars_payment_external_id_idx" ON "stars_payment"("external_id");

-- CreateIndex
CREATE INDEX "stars_payment_status_idx" ON "stars_payment"("status");

-- AddForeignKey
ALTER TABLE "user_sidebar_preference" ADD CONSTRAINT "user_sidebar_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification_preference" ADD CONSTRAINT "user_notification_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notification_read" ADD CONSTRAINT "admin_notification_read_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "admin_notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_point_rule" ADD CONSTRAINT "space_point_rule_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_point_ranking_prize" ADD CONSTRAINT "space_point_ranking_prize_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_space_point" ADD CONSTRAINT "user_space_point_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_space_point" ADD CONSTRAINT "user_space_point_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_point_transaction" ADD CONSTRAINT "space_point_transaction_user_point_id_fkey" FOREIGN KEY ("user_point_id") REFERENCES "user_space_point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_point_transaction" ADD CONSTRAINT "space_point_transaction_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "space_point_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_space_point_seal" ADD CONSTRAINT "user_space_point_seal_user_point_id_fkey" FOREIGN KEY ("user_point_id") REFERENCES "user_space_point"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_space_point_seal" ADD CONSTRAINT "user_space_point_seal_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "space_point_level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stars_payment" ADD CONSTRAINT "stars_payment_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "payment_gateway_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
