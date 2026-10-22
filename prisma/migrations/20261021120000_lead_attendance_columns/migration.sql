-- Estado de atendimento ao vivo (spec 0113, revisão 9.1). Colunas opcionais, sem valor padrão: aditivo e instantâneo.
ALTER TABLE "leads" ADD COLUMN "last_human_reply_at" TIMESTAMP(3),
ADD COLUMN "awaiting_since" TIMESTAMP(3);
