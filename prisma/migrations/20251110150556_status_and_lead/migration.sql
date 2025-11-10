-- AlterTable
ALTER TABLE "public"."tracking" ADD COLUMN     "organization_id" TEXT NOT NULL DEFAULT 'temp-org-id';

-- CreateTable
CREATE TABLE "public"."status" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "tracking_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."leads" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "description" TEXT,
    "status_id" TEXT NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_phone_tracking_id_key" ON "public"."leads"("phone", "tracking_id");

-- AddForeignKey
ALTER TABLE "public"."tracking" ADD CONSTRAINT "tracking_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."status" ADD CONSTRAINT "status_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "public"."tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_tracking_id_fkey" FOREIGN KEY ("tracking_id") REFERENCES "public"."tracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
