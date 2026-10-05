-- Spec 0065: chaves de acesso de IA externa ao MCP do ÓRBITA.
CREATE TABLE "external_ai_access_tokens" (
    "id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "organization_ids" TEXT[],
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_ai_access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_ai_access_tokens_token_hash_key" ON "external_ai_access_tokens"("token_hash");
CREATE INDEX "external_ai_access_tokens_created_by_id_idx" ON "external_ai_access_tokens"("created_by_id");
