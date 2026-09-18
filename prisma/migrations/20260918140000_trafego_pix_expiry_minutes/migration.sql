-- Spec 0020 — validade da cobrança PIX passa de horas para minutos.
--
-- Horas não expressam 10 minutos, e a janela curta é o que se quer na tela do
-- cliente. Converte o valor existente (48h → 2880min) em vez de assumir o
-- default, para não encurtar sem querer a validade de quem já configurou.
--
-- Reversível: a coluna antiga volta com o valor dividido por 60.

ALTER TABLE "trafego_settings"
  ADD COLUMN "pix_expiry_minutes" INTEGER NOT NULL DEFAULT 10;

UPDATE "trafego_settings"
  SET "pix_expiry_minutes" = GREATEST("pix_expiry_hours" * 60, 1);

ALTER TABLE "trafego_settings"
  DROP COLUMN "pix_expiry_hours";
