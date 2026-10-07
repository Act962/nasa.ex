-- Spec 0073: erros do ASTRO apontados pelo usuário ("errou"). Só aditiva.
CREATE TABLE "astro_correction" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "user_message" TEXT NOT NULL,
    "astro_reply" TEXT NOT NULL,
    "route" TEXT,
    "tools_called" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "transcript" JSONB NOT NULL DEFAULT '[]',
    "expected" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution_note" TEXT,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "astro_correction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "astro_correction_status_created_at_idx" ON "astro_correction"("status", "created_at");
CREATE INDEX "astro_correction_organization_id_created_at_idx" ON "astro_correction"("organization_id", "created_at");
CREATE INDEX "astro_correction_user_id_channel_created_at_idx" ON "astro_correction"("user_id", "channel", "created_at");
