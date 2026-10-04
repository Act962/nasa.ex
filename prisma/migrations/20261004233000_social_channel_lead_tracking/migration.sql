-- Spec 0062: tracking que recebe os leads do Instagram no tracking-chat.
ALTER TABLE "social_channels" ADD COLUMN "lead_tracking_id" TEXT;
