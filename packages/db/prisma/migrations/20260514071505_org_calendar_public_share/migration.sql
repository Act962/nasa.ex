-- AlterTable
ALTER TABLE "organization"
  ADD COLUMN "calendar_public_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "calendar_public_token" TEXT,
  ADD COLUMN "calendar_public_expires_at" TIMESTAMP(3),
  ADD COLUMN "calendar_public_enabled_at" TIMESTAMP(3),
  ADD COLUMN "calendar_public_enabled_by" TEXT,
  ADD COLUMN "calendar_public_consent_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "organization_calendar_public_token_key" ON "organization"("calendar_public_token");

-- CreateIndex
CREATE INDEX "organization_calendar_public_expires_at_idx" ON "organization"("calendar_public_expires_at") WHERE "calendar_public_enabled" = true;
