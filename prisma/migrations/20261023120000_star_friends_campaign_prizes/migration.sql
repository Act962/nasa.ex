-- STAR FRIENDS: mais de um prêmio por campanha de sorteio (spec 0102, RF-16). Só aditiva.
ALTER TABLE "loyalty_campaigns" ADD COLUMN "prize_count" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "loyalty_lucky_numbers" ADD COLUMN "draw_position" INTEGER;
