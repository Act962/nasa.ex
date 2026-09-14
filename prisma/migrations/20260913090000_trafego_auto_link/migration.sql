-- trafeGO (spec 0009, Fase C): vínculo automático da campanha do Meta pelo
-- código no nome (TG-0007). Só adição.

ALTER TABLE "trafego_order" ADD COLUMN "meta_auto_linked_at" TIMESTAMP(3);
