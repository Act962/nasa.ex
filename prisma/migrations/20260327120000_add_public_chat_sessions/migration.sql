-- CreateTable
CREATE TABLE "public_chat_sessions" (
    "id" TEXT NOT NULL,
    "agenda_id" TEXT NOT NULL,
    "org_slug" TEXT NOT NULL,
    "agenda_slug" TEXT NOT NULL,
    "appointment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "public_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "public_chat_sessions_agenda_id_idx" ON "public_chat_sessions"("agenda_id");

-- CreateIndex
CREATE INDEX "public_chat_sessions_expires_at_idx" ON "public_chat_sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "public_chat_sessions" ADD CONSTRAINT "public_chat_sessions_agenda_id_fkey" FOREIGN KEY ("agenda_id") REFERENCES "agendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
