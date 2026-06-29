-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'DONE');

-- CreateTable
CREATE TABLE "agendas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "tracking_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_responsibles" (
    "id" TEXT NOT NULL,
    "agenda_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_responsibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_availabilities" (
    "id" TEXT NOT NULL,
    "agenda_id" TEXT NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "agenda_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_time_slots" (
    "id" TEXT NOT NULL,
    "availability_id" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "availability_time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "agenda_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "user_id" TEXT,
    "title" TEXT,
    "notes" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agendas_tracking_id_idx" ON "agendas"("tracking_id");

-- CreateIndex
CREATE INDEX "agendas_organization_id_idx" ON "agendas"("organization_id");

-- CreateIndex
CREATE INDEX "agendas_is_active_idx" ON "agendas"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "agendas_slug_organization_id_key" ON "agendas"("slug", "organization_id");

-- CreateIndex
CREATE INDEX "agenda_responsibles_agenda_id_idx" ON "agenda_responsibles"("agenda_id");

-- CreateIndex
CREATE INDEX "agenda_responsibles_user_id_idx" ON "agenda_responsibles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "agenda_responsibles_agenda_id_user_id_key" ON "agenda_responsibles"("agenda_id", "user_id");

-- CreateIndex
CREATE INDEX "agenda_availabilities_agenda_id_idx" ON "agenda_availabilities"("agenda_id");

-- CreateIndex
CREATE UNIQUE INDEX "agenda_availabilities_agenda_id_day_of_week_key" ON "agenda_availabilities"("agenda_id", "day_of_week");

-- CreateIndex
CREATE INDEX "availability_time_slots_availability_id_idx" ON "availability_time_slots"("availability_id");

-- CreateIndex
CREATE INDEX "appointments_agenda_id_idx" ON "appointments"("agenda_id");

-- CreateIndex
CREATE INDEX "appointments_lead_id_idx" ON "appointments"("lead_id");

-- CreateIndex
CREATE INDEX "appointments_user_id_idx" ON "appointments"("user_id");

-- CreateIndex
CREATE INDEX "appointments_starts_at_idx" ON "appointments"("starts_at");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- AddForeignKey
ALTER TABLE "agendas" ADD CONSTRAINT "agendas_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendas" ADD CONSTRAINT "agendas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_responsibles" ADD CONSTRAINT "agenda_responsibles_agenda_id_fkey" FOREIGN KEY ("agenda_id") REFERENCES "agendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_responsibles" ADD CONSTRAINT "agenda_responsibles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_availabilities" ADD CONSTRAINT "agenda_availabilities_agenda_id_fkey" FOREIGN KEY ("agenda_id") REFERENCES "agendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_time_slots" ADD CONSTRAINT "availability_time_slots_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "agenda_availabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_agenda_id_fkey" FOREIGN KEY ("agenda_id") REFERENCES "agendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
