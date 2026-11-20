-- Linnker: por link, mostrar o título sobre a imagem do card e sombra do card/botão. Aditiva: tudo ligado como antes.
ALTER TABLE "linnker_links" ADD COLUMN "show_title" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "linnker_links" ADD COLUMN "has_shadow" BOOLEAN NOT NULL DEFAULT true;
