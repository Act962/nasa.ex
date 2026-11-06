-- Órbita Station 3D, etapa 2 (spec 0119): estação da empresa e avatar do usuário.

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "orbita_avatar" JSONB;

-- CreateTable
CREATE TABLE "orbita_stations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "template_key" TEXT NOT NULL DEFAULT 'completo',
    "room_names" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orbita_stations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orbita_stations_organization_id_key" ON "orbita_stations"("organization_id");

-- AddForeignKey
ALTER TABLE "orbita_stations" ADD CONSTRAINT "orbita_stations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
