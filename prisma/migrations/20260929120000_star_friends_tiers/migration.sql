-- STAR FRIENDS: níveis Terra/Lua/Galaxy e nível mínimo por prêmio (spec 0041). Só aditiva.
CREATE TYPE "LoyaltyTier" AS ENUM ('EARTH', 'MOON', 'GALAXY');

ALTER TABLE "loyalty_programs"
  ADD COLUMN "moon_min_stars" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "galaxy_min_stars" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "earth_perks" TEXT,
  ADD COLUMN "moon_perks" TEXT,
  ADD COLUMN "galaxy_perks" TEXT;

ALTER TABLE "loyalty_rewards"
  ADD COLUMN "min_tier" "LoyaltyTier" NOT NULL DEFAULT 'EARTH';
