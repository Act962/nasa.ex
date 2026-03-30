-- DropForeignKey
ALTER TABLE "form_settings" DROP CONSTRAINT "form_settings_status_id_fkey";

-- DropForeignKey
ALTER TABLE "form_settings" DROP CONSTRAINT "form_settings_tracking_id_fkey";

-- AddForeignKey
ALTER TABLE "form_settings" ADD CONSTRAINT "form_settings_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_settings" ADD CONSTRAINT "form_settings_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "status"("id") ON DELETE SET NULL ON UPDATE CASCADE;
