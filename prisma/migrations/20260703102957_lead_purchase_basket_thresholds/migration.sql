-- Cesta de compra do lead no card do Tracking. Thresholds em dias que
-- definem a cor do ícone (verde/amarelo/laranja/vermelho + cinza sem compra).
ALTER TABLE "tracking_card_config"
  ADD COLUMN "show_purchase_basket" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "basket_recent_days"   INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "basket_medium_days"   INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "basket_long_days"     INTEGER NOT NULL DEFAULT 90;
