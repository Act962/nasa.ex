-- CreateTable
CREATE TABLE "meta_mcp_authorizations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "authorized_by_id" TEXT NOT NULL,
    "authorized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "meta_mcp_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ads_pending_actions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executed_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "meta_ads_pending_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meta_mcp_authorizations_organization_id_user_id_key"
    ON "meta_mcp_authorizations"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "meta_mcp_authorizations_organization_id_idx"
    ON "meta_mcp_authorizations"("organization_id");

-- CreateIndex
CREATE INDEX "meta_ads_pending_actions_organization_id_status_expires_at_idx"
    ON "meta_ads_pending_actions"("organization_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "meta_ads_pending_actions_user_id_idx"
    ON "meta_ads_pending_actions"("user_id");

-- AddForeignKey
ALTER TABLE "meta_mcp_authorizations" ADD CONSTRAINT "meta_mcp_authorizations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_mcp_authorizations" ADD CONSTRAINT "meta_mcp_authorizations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_mcp_authorizations" ADD CONSTRAINT "meta_mcp_authorizations_authorized_by_id_fkey"
    FOREIGN KEY ("authorized_by_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads_pending_actions" ADD CONSTRAINT "meta_ads_pending_actions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads_pending_actions" ADD CONSTRAINT "meta_ads_pending_actions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
