-- Adiciona enums + tabelas Meta Ads.
-- Idempotente: usa IF NOT EXISTS e DO blocks para enums.
-- NÃO altera/dropa nada existente.

DO $$ BEGIN
  CREATE TYPE "MetaAdEntityStatus" AS ENUM (
    'ACTIVE','PAUSED','DELETED','ARCHIVED','PENDING_REVIEW',
    'DISAPPROVED','PREAPPROVED','PENDING_BILLING_INFO',
    'CAMPAIGN_PAUSED','ADSET_PAUSED','IN_PROCESS','WITH_ISSUES'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MetaAdLevel" AS ENUM ('ACCOUNT','CAMPAIGN','ADSET','AD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "meta_ads_kpi_snapshots" (
  "id"              TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "level"           "MetaAdLevel" NOT NULL,
  "entity_id"       TEXT NOT NULL,
  "entity_name"     TEXT,
  "date"            DATE NOT NULL,
  "date_preset"     TEXT,
  "reach"             INTEGER NOT NULL DEFAULT 0,
  "impressions"       INTEGER NOT NULL DEFAULT 0,
  "frequency"         DECIMAL(10,4) NOT NULL DEFAULT 0,
  "clicks"            INTEGER NOT NULL DEFAULT 0,
  "ctr"               DECIMAL(10,4) NOT NULL DEFAULT 0,
  "engagement"        INTEGER NOT NULL DEFAULT 0,
  "spend"             DECIMAL(14,2) NOT NULL DEFAULT 0,
  "cpm"               DECIMAL(14,4) NOT NULL DEFAULT 0,
  "cpc"               DECIMAL(14,4) NOT NULL DEFAULT 0,
  "cpp"               DECIMAL(14,4) NOT NULL DEFAULT 0,
  "cpl"               DECIMAL(14,4) NOT NULL DEFAULT 0,
  "cpa"               DECIMAL(14,4) NOT NULL DEFAULT 0,
  "cpv"               DECIMAL(14,4) NOT NULL DEFAULT 0,
  "conversions"       INTEGER NOT NULL DEFAULT 0,
  "leads"             INTEGER NOT NULL DEFAULT 0,
  "conversion_value"  DECIMAL(14,2) NOT NULL DEFAULT 0,
  "conversion_rate"   DECIMAL(10,4) NOT NULL DEFAULT 0,
  "roas"              DECIMAL(14,4) NOT NULL DEFAULT 0,
  "roi"               DECIMAL(14,4) NOT NULL DEFAULT 0,
  "video_plays"       INTEGER NOT NULL DEFAULT 0,
  "video_p25"         INTEGER NOT NULL DEFAULT 0,
  "video_p50"         INTEGER NOT NULL DEFAULT 0,
  "video_p75"         INTEGER NOT NULL DEFAULT 0,
  "video_p100"        INTEGER NOT NULL DEFAULT 0,
  "video_avg_watch_time" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "raw"               JSONB,
  "synced_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meta_ads_kpi_snapshots_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_ads_kpi_snapshots_unique"
  ON "meta_ads_kpi_snapshots" ("organization_id","level","entity_id","date");
CREATE INDEX IF NOT EXISTS "meta_ads_kpi_snapshots_org_level_date"
  ON "meta_ads_kpi_snapshots" ("organization_id","level","date");
CREATE INDEX IF NOT EXISTS "meta_ads_kpi_snapshots_org_entity"
  ON "meta_ads_kpi_snapshots" ("organization_id","entity_id");

CREATE TABLE IF NOT EXISTS "meta_ad_campaigns" (
  "id"                    TEXT PRIMARY KEY,
  "organization_id"       TEXT NOT NULL,
  "meta_campaign_id"      TEXT UNIQUE,
  "ad_account_id"         TEXT NOT NULL,
  "name"                  TEXT NOT NULL,
  "objective"             TEXT,
  "status"                "MetaAdEntityStatus" NOT NULL DEFAULT 'PAUSED',
  "effective_status"      TEXT,
  "special_ad_categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "buying_type"           TEXT,
  "daily_budget"          DECIMAL(14,2),
  "lifetime_budget"       DECIMAL(14,2),
  "bid_strategy"          TEXT,
  "start_time"            TIMESTAMP(3),
  "stop_time"             TIMESTAMP(3),
  "created_by_user_id"    TEXT,
  "last_synced_at"        TIMESTAMP(3),
  "raw"                   JSONB,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meta_ad_campaigns_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "meta_ad_campaigns_org" ON "meta_ad_campaigns"("organization_id");
CREATE INDEX IF NOT EXISTS "meta_ad_campaigns_account" ON "meta_ad_campaigns"("ad_account_id");

CREATE TABLE IF NOT EXISTS "meta_adsets" (
  "id"                TEXT PRIMARY KEY,
  "organization_id"   TEXT NOT NULL,
  "campaign_id"       TEXT NOT NULL,
  "meta_adset_id"     TEXT UNIQUE,
  "name"              TEXT NOT NULL,
  "status"            "MetaAdEntityStatus" NOT NULL DEFAULT 'PAUSED',
  "effective_status"  TEXT,
  "optimization_goal" TEXT,
  "billing_event"     TEXT,
  "bid_amount"        DECIMAL(14,4),
  "daily_budget"      DECIMAL(14,2),
  "lifetime_budget"   DECIMAL(14,2),
  "targeting"         JSONB,
  "start_time"        TIMESTAMP(3),
  "end_time"          TIMESTAMP(3),
  "last_synced_at"    TIMESTAMP(3),
  "raw"               JSONB,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meta_adsets_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "meta_adsets_campaign_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "meta_ad_campaigns"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "meta_adsets_org" ON "meta_adsets"("organization_id");
CREATE INDEX IF NOT EXISTS "meta_adsets_campaign" ON "meta_adsets"("campaign_id");

CREATE TABLE IF NOT EXISTS "meta_ads" (
  "id"                TEXT PRIMARY KEY,
  "organization_id"   TEXT NOT NULL,
  "campaign_id"       TEXT NOT NULL,
  "adset_id"          TEXT NOT NULL,
  "meta_ad_id"        TEXT UNIQUE,
  "name"              TEXT NOT NULL,
  "status"            "MetaAdEntityStatus" NOT NULL DEFAULT 'PAUSED',
  "effective_status"  TEXT,
  "creative_id"       TEXT,
  "creative"          JSONB,
  "preview_url"       TEXT,
  "last_synced_at"    TIMESTAMP(3),
  "raw"               JSONB,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meta_ads_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE,
  CONSTRAINT "meta_ads_campaign_fk"
    FOREIGN KEY ("campaign_id") REFERENCES "meta_ad_campaigns"("id") ON DELETE CASCADE,
  CONSTRAINT "meta_ads_adset_fk"
    FOREIGN KEY ("adset_id") REFERENCES "meta_adsets"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "meta_ads_org" ON "meta_ads"("organization_id");
CREATE INDEX IF NOT EXISTS "meta_ads_campaign" ON "meta_ads"("campaign_id");
CREATE INDEX IF NOT EXISTS "meta_ads_adset" ON "meta_ads"("adset_id");
