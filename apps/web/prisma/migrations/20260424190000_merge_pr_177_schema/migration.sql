-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('WORKSHOP', 'PALESTRA', 'LANCAMENTO', 'WEBINAR', 'NETWORKING', 'CURSO', 'REUNIAO', 'HACKATHON', 'CONFERENCIA', 'OUTRO');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "LinnkerLinkType" AS ENUM ('TRACKING', 'FORM', 'CHAT', 'EXTERNAL', 'AGENDA');

-- CreateEnum
CREATE TYPE "StationType" AS ENUM ('USER', 'ORG');

-- CreateEnum
CREATE TYPE "StationRank" AS ENUM ('COMMANDER', 'CREW');

-- CreateEnum
CREATE TYPE "StationModule" AS ENUM ('FORM', 'CHAT', 'AGENDA', 'INTEGRATION', 'NBOX', 'FORGE', 'APPS', 'NOTIFICATIONS');

-- CreateEnum
CREATE TYPE "StationAccessMode" AS ENUM ('OPEN', 'MEMBERS_ONLY', 'REQUEST');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('OFFICE', 'SPACE', 'NATURE', 'FANTASY', 'TECH', 'OTHER');

-- CreateEnum
CREATE TYPE "NasaPageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NasaPageIntent" AS ENUM ('INSTITUTIONAL', 'LANDING', 'BIO_LINK', 'EVENT', 'PRODUCT', 'PORTFOLIO', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NasaPageDomainStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "NasaPageDomainSource" AS ENUM ('EXTERNAL', 'PURCHASED_VIA_NASA');

-- CreateEnum
CREATE TYPE "NasaPageDomainPurchaseStatus" AS ENUM ('NOT_STARTED', 'SEARCHING', 'AWAITING_PAYMENT', 'PAID', 'REGISTERING', 'ACTIVE', 'FAILED');

-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'BR',
ADD COLUMN     "event_category" "EventCategory",
ADD COLUMN     "form_id" TEXT,
ADD COLUMN     "guest_draft_token" TEXT,
ADD COLUMN     "is_guest_draft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "likes_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "public_slug" TEXT,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "registration_url" TEXT,
ADD COLUMN     "share_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "view_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "channel" "MessageChannel" NOT NULL DEFAULT 'WHATSAPP';

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "address_line" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'BR',
ADD COLUMN     "geocoded_at" TIMESTAMP(3),
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "state" TEXT;

-- CreateTable
CREATE TABLE "action_likes" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "user_id" TEXT,
    "fingerprint" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_views" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "user_id" TEXT,
    "referrer" TEXT,
    "sharer_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_action_shares" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "sharer_user_id" TEXT,
    "sharer_token" TEXT NOT NULL,
    "platform" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_action_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_reminders" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "user_id" TEXT,
    "phone_number" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL DEFAULT 'WHATSAPP',
    "remind_at" TIMESTAMP(3) NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "consent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linnker_pages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bio" TEXT,
    "avatar_url" TEXT,
    "cover_color" TEXT NOT NULL DEFAULT '#6366f1',
    "button_style" TEXT NOT NULL DEFAULT 'rounded',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "banner_url" TEXT,
    "background_color" TEXT,
    "background_image" TEXT,
    "background_opacity" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "social_links" JSONB,
    "social_icon_color" TEXT,
    "title_color" TEXT,
    "bio_color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linnker_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linnker_links" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "type" "LinnkerLinkType" NOT NULL DEFAULT 'EXTERNAL',
    "icon" TEXT,
    "emoji" TEXT,
    "image_url" TEXT,
    "display_style" TEXT NOT NULL DEFAULT 'button',
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linnker_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linnker_scans" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linnker_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_stations" (
    "id" TEXT NOT NULL,
    "type" "StationType" NOT NULL,
    "user_id" TEXT,
    "org_id" TEXT,
    "nick" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT,
    "avatar_url" TEXT,
    "banner_url" TEXT,
    "theme" JSONB,
    "rank" "StationRank" NOT NULL DEFAULT 'CREW',
    "stars_received" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,
    "access_mode" "StationAccessMode" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station_access_requests" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "station_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_station_worlds" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "map_data" JSONB,
    "planet_color" TEXT NOT NULL DEFAULT '#4B0082',
    "ambient_theme" TEXT NOT NULL DEFAULT 'space',
    "avatar_config" JSONB,
    "npc_config" JSONB,
    "meeting_points" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "space_station_worlds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_station_stars" (
    "id" TEXT NOT NULL,
    "from_id" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "space_station_stars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station_public_modules" (
    "id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "module" "StationModule" NOT NULL,
    "resource_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "station_public_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_game_assets" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "preview_url" TEXT,
    "config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_game_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "author_id" TEXT NOT NULL,
    "station_id" TEXT,
    "preview_url" TEXT,
    "map_data" JSONB NOT NULL,
    "category" "TemplateCategory" NOT NULL DEFAULT 'OTHER',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avatar_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "preview_url" TEXT,
    "sprite_url" TEXT NOT NULL,
    "overlays" JSONB,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avatar_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "connected_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_pages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "favicon_url" TEXT,
    "og_image_url" TEXT,
    "intent" "NasaPageIntent" NOT NULL DEFAULT 'CUSTOM',
    "status" "NasaPageStatus" NOT NULL DEFAULT 'DRAFT',
    "layer_count" INTEGER NOT NULL DEFAULT 1,
    "palette" JSONB NOT NULL DEFAULT '{}',
    "font_family" TEXT,
    "layout" JSONB NOT NULL DEFAULT '{}',
    "published_layout" JSONB,
    "published_at" TIMESTAMP(3),
    "custom_domain" TEXT,
    "domain_status" "NasaPageDomainStatus",
    "domain_source" "NasaPageDomainSource",
    "domain_verify_token" TEXT,
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "template_marked_by_moderator" BOOLEAN NOT NULL DEFAULT false,
    "template_category" TEXT,
    "stars_spent" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_page_versions" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "label" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nasa_page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_page_assets" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "original_name" TEXT,
    "size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nasa_page_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_page_visits" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "path" TEXT,
    "referrer" TEXT,
    "user_agent" TEXT,
    "country" TEXT,
    "ip_address" TEXT,
    "device" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nasa_page_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_page_domain_purchases" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "requested_domain" TEXT NOT NULL,
    "tld_price_cents" INTEGER,
    "currency" TEXT,
    "checkout_url" TEXT,
    "external_order_id" TEXT,
    "status" "NasaPageDomainPurchaseStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nasa_page_domain_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_likes_action_id_idx" ON "action_likes"("action_id");

-- CreateIndex
CREATE INDEX "action_likes_user_id_idx" ON "action_likes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "action_likes_action_id_user_id_key" ON "action_likes"("action_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "action_likes_action_id_fingerprint_key" ON "action_likes"("action_id", "fingerprint");

-- CreateIndex
CREATE INDEX "action_views_action_id_created_at_idx" ON "action_views"("action_id", "created_at");

-- CreateIndex
CREATE INDEX "action_views_sharer_token_idx" ON "action_views"("sharer_token");

-- CreateIndex
CREATE UNIQUE INDEX "action_views_action_id_fingerprint_key" ON "action_views"("action_id", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "public_action_shares_sharer_token_key" ON "public_action_shares"("sharer_token");

-- CreateIndex
CREATE INDEX "public_action_shares_action_id_idx" ON "public_action_shares"("action_id");

-- CreateIndex
CREATE INDEX "public_action_shares_sharer_user_id_idx" ON "public_action_shares"("sharer_user_id");

-- CreateIndex
CREATE INDEX "action_reminders_action_id_sent_idx" ON "action_reminders"("action_id", "sent");

-- CreateIndex
CREATE INDEX "action_reminders_remind_at_sent_idx" ON "action_reminders"("remind_at", "sent");

-- CreateIndex
CREATE UNIQUE INDEX "linnker_pages_slug_key" ON "linnker_pages"("slug");

-- CreateIndex
CREATE INDEX "linnker_pages_organization_id_idx" ON "linnker_pages"("organization_id");

-- CreateIndex
CREATE INDEX "linnker_links_page_id_idx" ON "linnker_links"("page_id");

-- CreateIndex
CREATE INDEX "linnker_scans_page_id_idx" ON "linnker_scans"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "space_stations_user_id_key" ON "space_stations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "space_stations_org_id_key" ON "space_stations"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "space_stations_nick_key" ON "space_stations"("nick");

-- CreateIndex
CREATE INDEX "station_access_requests_station_id_status_idx" ON "station_access_requests"("station_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "station_access_requests_station_id_user_id_key" ON "station_access_requests"("station_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "space_station_worlds_station_id_key" ON "space_station_worlds"("station_id");

-- CreateIndex
CREATE INDEX "space_station_stars_from_id_idx" ON "space_station_stars"("from_id");

-- CreateIndex
CREATE INDEX "space_station_stars_to_id_idx" ON "space_station_stars"("to_id");

-- CreateIndex
CREATE INDEX "station_public_modules_station_id_idx" ON "station_public_modules"("station_id");

-- CreateIndex
CREATE UNIQUE INDEX "station_public_modules_station_id_module_key" ON "station_public_modules"("station_id", "module");

-- CreateIndex
CREATE INDEX "world_game_assets_type_idx" ON "world_game_assets"("type");

-- CreateIndex
CREATE INDEX "world_templates_is_public_category_idx" ON "world_templates"("is_public", "category");

-- CreateIndex
CREATE INDEX "avatar_templates_is_public_idx" ON "avatar_templates"("is_public");

-- CreateIndex
CREATE INDEX "user_connections_user_id_idx" ON "user_connections"("user_id");

-- CreateIndex
CREATE INDEX "user_connections_connected_id_idx" ON "user_connections"("connected_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_connections_user_id_connected_id_key" ON "user_connections"("user_id", "connected_id");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_pages_slug_key" ON "nasa_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_pages_custom_domain_key" ON "nasa_pages"("custom_domain");

-- CreateIndex
CREATE INDEX "nasa_pages_organization_id_idx" ON "nasa_pages"("organization_id");

-- CreateIndex
CREATE INDEX "nasa_pages_status_idx" ON "nasa_pages"("status");

-- CreateIndex
CREATE INDEX "nasa_pages_custom_domain_idx" ON "nasa_pages"("custom_domain");

-- CreateIndex
CREATE INDEX "nasa_page_versions_page_id_idx" ON "nasa_page_versions"("page_id");

-- CreateIndex
CREATE INDEX "nasa_page_assets_page_id_idx" ON "nasa_page_assets"("page_id");

-- CreateIndex
CREATE INDEX "nasa_page_assets_organization_id_idx" ON "nasa_page_assets"("organization_id");

-- CreateIndex
CREATE INDEX "nasa_page_visits_page_id_idx" ON "nasa_page_visits"("page_id");

-- CreateIndex
CREATE INDEX "nasa_page_visits_created_at_idx" ON "nasa_page_visits"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_page_domain_purchases_page_id_key" ON "nasa_page_domain_purchases"("page_id");

-- CreateIndex
CREATE INDEX "nasa_page_domain_purchases_status_idx" ON "nasa_page_domain_purchases"("status");

-- CreateIndex
CREATE UNIQUE INDEX "actions_public_slug_key" ON "actions"("public_slug");

-- CreateIndex
CREATE UNIQUE INDEX "actions_guest_draft_token_key" ON "actions"("guest_draft_token");

-- CreateIndex
CREATE INDEX "actions_is_public_published_at_idx" ON "actions"("is_public", "published_at");

-- CreateIndex
CREATE INDEX "actions_country_state_city_idx" ON "actions"("country", "state", "city");

-- CreateIndex
CREATE INDEX "actions_event_category_idx" ON "actions"("event_category");

-- AddForeignKey
ALTER TABLE "action_likes" ADD CONSTRAINT "action_likes_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_likes" ADD CONSTRAINT "action_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_views" ADD CONSTRAINT "action_views_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_action_shares" ADD CONSTRAINT "public_action_shares_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_action_shares" ADD CONSTRAINT "public_action_shares_sharer_user_id_fkey" FOREIGN KEY ("sharer_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_reminders" ADD CONSTRAINT "action_reminders_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_reminders" ADD CONSTRAINT "action_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linnker_pages" ADD CONSTRAINT "linnker_pages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linnker_pages" ADD CONSTRAINT "linnker_pages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linnker_links" ADD CONSTRAINT "linnker_links_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "linnker_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linnker_scans" ADD CONSTRAINT "linnker_scans_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "linnker_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linnker_scans" ADD CONSTRAINT "linnker_scans_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_stations" ADD CONSTRAINT "space_stations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_stations" ADD CONSTRAINT "space_stations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_access_requests" ADD CONSTRAINT "station_access_requests_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "space_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_access_requests" ADD CONSTRAINT "station_access_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_station_worlds" ADD CONSTRAINT "space_station_worlds_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "space_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_station_stars" ADD CONSTRAINT "space_station_stars_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "space_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_station_stars" ADD CONSTRAINT "space_station_stars_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "space_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_public_modules" ADD CONSTRAINT "station_public_modules_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "space_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_templates" ADD CONSTRAINT "world_templates_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_templates" ADD CONSTRAINT "avatar_templates_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_connected_id_fkey" FOREIGN KEY ("connected_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_pages" ADD CONSTRAINT "nasa_pages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_pages" ADD CONSTRAINT "nasa_pages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_page_versions" ADD CONSTRAINT "nasa_page_versions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "nasa_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_page_assets" ADD CONSTRAINT "nasa_page_assets_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "nasa_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_page_visits" ADD CONSTRAINT "nasa_page_visits_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "nasa_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nasa_page_domain_purchases" ADD CONSTRAINT "nasa_page_domain_purchases_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "nasa_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

