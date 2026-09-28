-- spec 0008 — Anexos em lançamentos financeiros e biblioteca de documentos.
-- Migration puramente aditiva: cria enum + tabela, não altera coluna existente.
-- Rollback: DROP TABLE "payment_attachments"; DROP TYPE "PaymentAttachmentKind";

-- CreateEnum
CREATE TYPE "PaymentAttachmentKind" AS ENUM ('NOTA_FISCAL', 'BOLETO', 'RECIBO', 'COMPROVANTE', 'CONTRATO', 'OUTRO');

-- CreateTable
CREATE TABLE "payment_attachments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entry_id" TEXT,
    "file_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "kind" "PaymentAttachmentKind" NOT NULL DEFAULT 'OUTRO',
    "description" TEXT,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_attachments_organization_id_created_at_idx" ON "payment_attachments"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_attachments_entry_id_idx" ON "payment_attachments"("entry_id");

-- CreateIndex
CREATE INDEX "payment_attachments_kind_idx" ON "payment_attachments"("kind");

-- CreateIndex
CREATE INDEX "payment_attachments_file_key_idx" ON "payment_attachments"("file_key");

-- AddForeignKey
ALTER TABLE "payment_attachments" ADD CONSTRAINT "payment_attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attachments" ADD CONSTRAINT "payment_attachments_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "payment_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attachments" ADD CONSTRAINT "payment_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
