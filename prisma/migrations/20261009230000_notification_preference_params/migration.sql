-- Spec 0081: ajustes por aviso (hora do resumo do dia, dias de antecedência). Coluna opcional.
ALTER TABLE "user_notification_preference" ADD COLUMN "params" JSONB;
