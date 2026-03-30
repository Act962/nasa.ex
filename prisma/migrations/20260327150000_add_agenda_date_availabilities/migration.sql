-- CreateTable
CREATE TABLE "agenda_date_availabilities" (
    "id" TEXT NOT NULL,
    "agenda_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_date_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_date_availability_slots" (
    "id" TEXT NOT NULL,
    "date_availability_id" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "agenda_date_availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agenda_date_availabilities_agenda_id_idx" ON "agenda_date_availabilities"("agenda_id");

-- CreateIndex
CREATE UNIQUE INDEX "agenda_date_availabilities_agenda_id_date_key" ON "agenda_date_availabilities"("agenda_id", "date");

-- CreateIndex
CREATE INDEX "agenda_date_availability_slots_date_availability_id_idx" ON "agenda_date_availability_slots"("date_availability_id");

-- AddForeignKey
ALTER TABLE "agenda_date_availabilities" ADD CONSTRAINT "agenda_date_availabilities_agenda_id_fkey" FOREIGN KEY ("agenda_id") REFERENCES "agendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_date_availability_slots" ADD CONSTRAINT "agenda_date_availability_slots_date_availability_id_fkey" FOREIGN KEY ("date_availability_id") REFERENCES "agenda_date_availabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
