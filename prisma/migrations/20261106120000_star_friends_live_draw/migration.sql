-- Sorteio ao vivo do STAR FRIENDS (spec 0134): um registro por número tirado, inclusive os revogados.
CREATE TABLE "loyalty_campaign_draws" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "lucky_number_id" TEXT,
    "member_id" TEXT,
    "position" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "member_name" TEXT NOT NULL,
    "member_phone" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "pool_size" INTEGER NOT NULL,
    "actor_user_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "drawn_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_name" TEXT,
    "revoke_reason" TEXT,

    CONSTRAINT "loyalty_campaign_draws_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "loyalty_campaign_draws_campaign_id_drawn_at_idx" ON "loyalty_campaign_draws"("campaign_id", "drawn_at");

ALTER TABLE "loyalty_campaign_draws" ADD CONSTRAINT "loyalty_campaign_draws_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "loyalty_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "loyalty_campaign_draws" ADD CONSTRAINT "loyalty_campaign_draws_lucky_number_id_fkey" FOREIGN KEY ("lucky_number_id") REFERENCES "loyalty_lucky_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
