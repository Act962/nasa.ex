-- Migration: 20260406140000_space_points_gamification
-- Applied via: prisma migrate resolve --applied (tables already exist via db push)

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
CREATE INDEX "achievement_popup_template_type_idx" ON "achievement_popup_template"("type");

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
