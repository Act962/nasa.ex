-- CreateTable
CREATE TABLE "agenda_date_overrides" (
    "id" TEXT NOT NULL,
    "agenda_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "is_blocked" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_date_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agenda_date_overrides_agenda_id_idx" ON "agenda_date_overrides"("agenda_id");

-- CreateIndex
CREATE UNIQUE INDEX "agenda_date_overrides_agenda_id_date_key" ON "agenda_date_overrides"("agenda_id", "date");

-- AddForeignKey
ALTER TABLE "agenda_date_overrides" ADD CONSTRAINT "agenda_date_overrides_agenda_id_fkey" FOREIGN KEY ("agenda_id") REFERENCES "agendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
