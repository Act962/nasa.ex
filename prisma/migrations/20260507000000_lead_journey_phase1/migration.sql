-- AlterTable: Lead — adiciona campos de origem (UTM + CTWA + Meta Ads) e jornada (timestamps)
ALTER TABLE "leads"
    ADD COLUMN "utm_source" TEXT,
    ADD COLUMN "utm_medium" TEXT,
    ADD COLUMN "utm_campaign" TEXT,
    ADD COLUMN "utm_content" TEXT,
    ADD COLUMN "utm_term" TEXT,
    ADD COLUMN "referrer" TEXT,
    ADD COLUMN "landing_page" TEXT,
    ADD COLUMN "device" TEXT,
    ADD COLUMN "ctwa_clid" TEXT,
    ADD COLUMN "meta_ad_id" TEXT,
    ADD COLUMN "meta_adset_id" TEXT,
    ADD COLUMN "meta_campaign_id" TEXT,
    ADD COLUMN "meta_source_url" TEXT,
    ADD COLUMN "meta_headline" TEXT,
    ADD COLUMN "meta_body" TEXT,
    ADD COLUMN "assigned_at" TIMESTAMP(3),
    ADD COLUMN "last_inbound_at" TIMESTAMP(3),
    ADD COLUMN "last_outbound_at" TIMESTAMP(3),
    ADD COLUMN "first_response_at" TIMESTAMP(3),
    ADD COLUMN "last_status_change_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "leads_utm_campaign_idx" ON "leads"("utm_campaign");
CREATE INDEX "leads_meta_ad_id_idx" ON "leads"("meta_ad_id");
CREATE INDEX "leads_meta_campaign_id_idx" ON "leads"("meta_campaign_id");
CREATE INDEX "leads_last_inbound_at_idx" ON "leads"("last_inbound_at");
CREATE INDEX "leads_assigned_at_idx" ON "leads"("assigned_at");

-- CreateTable: LeadJourneyEvent — timeline granular de eventos por lead
CREATE TABLE "lead_journey_events" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_journey_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_journey_events_lead_id_occurred_at_idx"
    ON "lead_journey_events"("lead_id", "occurred_at");

CREATE INDEX "lead_journey_events_kind_idx" ON "lead_journey_events"("kind");

-- AddForeignKey
ALTER TABLE "lead_journey_events"
    ADD CONSTRAINT "lead_journey_events_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_journey_events"
    ADD CONSTRAINT "lead_journey_events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
