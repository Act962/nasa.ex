-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "action_id" TEXT;

-- CreateTable
CREATE TABLE "action_chat_messages" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "body" TEXT,
    "media_url" TEXT,
    "media_type" TEXT,
    "mimetype" TEXT,
    "file_name" TEXT,
    "quoted_message_id" TEXT,
    "sender_id" TEXT NOT NULL,
    "sender_name" TEXT,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_chat_reads" (
    "id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_chat_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_chat_messages_action_id_created_at_idx" ON "action_chat_messages"("action_id", "created_at");

-- CreateIndex
CREATE INDEX "action_chat_messages_sender_id_idx" ON "action_chat_messages"("sender_id");

-- CreateIndex
CREATE INDEX "action_chat_reads_user_id_idx" ON "action_chat_reads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "action_chat_reads_action_id_user_id_key" ON "action_chat_reads"("action_id", "user_id");

-- CreateIndex
CREATE INDEX "reminders_action_id_is_active_idx" ON "reminders"("action_id", "is_active");

-- AddForeignKey
ALTER TABLE "action_chat_messages" ADD CONSTRAINT "action_chat_messages_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_chat_messages" ADD CONSTRAINT "action_chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_chat_messages" ADD CONSTRAINT "action_chat_messages_quoted_message_id_fkey" FOREIGN KEY ("quoted_message_id") REFERENCES "action_chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_chat_reads" ADD CONSTRAINT "action_chat_reads_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_chat_reads" ADD CONSTRAINT "action_chat_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
