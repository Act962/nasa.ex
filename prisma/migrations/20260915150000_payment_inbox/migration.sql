-- spec 0018 — caixa de entrada Gmail do financeiro. Aditiva.
-- Rollback:
--   DROP TABLE "payment_inbox_items"; DROP TABLE "payment_inbox_configs";
--   DROP TYPE "PaymentInboxItemStatus";

-- CreateEnum
CREATE TYPE "PaymentInboxItemStatus" AS ENUM ('NEW', 'PROPOSED', 'ACCEPTED', 'IGNORED', 'FAILED');

-- CreateTable
CREATE TABLE "payment_inbox_configs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "gmail_query" TEXT NOT NULL DEFAULT 'has:attachment filename:pdf newer_than:7d',
    "notify_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "last_history_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_inbox_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_inbox_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gmail_message_id" TEXT NOT NULL,
    "gmail_attachment_id" TEXT NOT NULL,
    "thread_id" TEXT,
    "subject" TEXT NOT NULL,
    "from_email" TEXT NOT NULL,
    "from_name" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "attachment_id" TEXT,
    "status" "PaymentInboxItemStatus" NOT NULL DEFAULT 'NEW',
    "extraction" JSONB,
    "entry_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_inbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_inbox_configs_organization_id_key" ON "payment_inbox_configs"("organization_id");

-- CreateIndex
CREATE INDEX "payment_inbox_items_organization_id_status_received_at_idx" ON "payment_inbox_items"("organization_id", "status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_inbox_items_org_message_attachment_key" ON "payment_inbox_items"("organization_id", "gmail_message_id", "gmail_attachment_id");

-- AddForeignKey
ALTER TABLE "payment_inbox_configs" ADD CONSTRAINT "payment_inbox_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_inbox_items" ADD CONSTRAINT "payment_inbox_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_inbox_items" ADD CONSTRAINT "payment_inbox_items_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "payment_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_inbox_items" ADD CONSTRAINT "payment_inbox_items_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "payment_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
