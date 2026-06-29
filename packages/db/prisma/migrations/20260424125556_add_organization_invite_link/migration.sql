-- CreateTable
CREATE TABLE "organization_invite_link" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "starsOnJoin" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_invite_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_invite_link_token_key" ON "organization_invite_link"("token");

-- CreateIndex
CREATE INDEX "organization_invite_link_organizationId_idx" ON "organization_invite_link"("organizationId");

-- CreateIndex
CREATE INDEX "organization_invite_link_token_idx" ON "organization_invite_link"("token");

-- AddForeignKey
ALTER TABLE "organization_invite_link" ADD CONSTRAINT "organization_invite_link_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_invite_link" ADD CONSTRAINT "organization_invite_link_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
