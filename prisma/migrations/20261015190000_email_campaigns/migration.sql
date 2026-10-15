-- Spec 0107: disparo de email e modelos (aditiva).
CREATE TABLE "email_template" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "previewText" TEXT,
    "bodyJson" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "email_template_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "email_template_organizationId_idx" ON "email_template"("organizationId");

CREATE TABLE "email_campaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT,
    "subject" TEXT NOT NULL,
    "previewText" TEXT,
    "bodyHtml" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "replyTo" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "email_campaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "email_campaign_organizationId_createdAt_idx" ON "email_campaign"("organizationId", "createdAt");
ALTER TABLE "email_campaign" ADD CONSTRAINT "email_campaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "email_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "email_campaign_recipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "leadId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "providerId" TEXT,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "email_campaign_recipient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_campaign_recipient_campaignId_email_key" ON "email_campaign_recipient"("campaignId", "email");
CREATE INDEX "email_campaign_recipient_campaignId_status_idx" ON "email_campaign_recipient"("campaignId", "status");
ALTER TABLE "email_campaign_recipient" ADD CONSTRAINT "email_campaign_recipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "email_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "email_unsubscribe" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_unsubscribe_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_unsubscribe_organizationId_email_key" ON "email_unsubscribe"("organizationId", "email");
