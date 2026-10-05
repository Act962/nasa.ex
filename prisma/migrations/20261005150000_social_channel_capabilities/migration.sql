-- Spec 0071: capacidades e validade do token das contas conectadas. Só aditiva.
ALTER TABLE "social_channels"
  ADD COLUMN "can_publish" BOOLEAN,
  ADD COLUMN "can_read_insights" BOOLEAN,
  ADD COLUMN "credentials_expires_at" TIMESTAMP(3);
