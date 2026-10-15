// Spec 0107 (RF-3/RF-5): envia o próximo lote pendente de uma campanha de email.
import "server-only";
import { resend } from "@/lib/email/resend";
import prisma from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { buildUnsubscribeUrl } from "./unsubscribe-token";
import { personalizeEmail, renderCampaignLayout, resolveSenderAddress } from "./render-email";

export const EMAIL_CAMPAIGN_SEND_EVENT = "campanhas/email-campaign.send";
export const EMAIL_SENT_JOURNEY_EVENT = "email_sent";
const BATCH_SIZE = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function ensureCampaignTagId(organizationId: string, campaignName: string): Promise<string> {
  const name = `Email: ${campaignName}`.slice(0, 80);
  const slug = slugify(name);
  const existing = await prisma.tag.findFirst({
    where: { organizationId, trackingId: null, slug },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.tag.create({
    data: {
      organizationId,
      name,
      slug,
      color: "#2563eb",
      description: "Recebeu esta campanha de email.",
    },
    select: { id: true },
  });
  return created.id;
}

/** Tag e Jornada direto no banco: receber o email não pode disparar fluxo (CA-4). */
async function markLeadsReached(
  organizationId: string,
  campaign: { id: string; name: string },
  leadIds: string[],
) {
  if (leadIds.length === 0) return;
  const tagId = await ensureCampaignTagId(organizationId, campaign.name);
  await prisma.leadTag.createMany({
    data: leadIds.map((leadId) => ({ leadId, tagId })),
    skipDuplicates: true,
  });
  await prisma.leadJourneyEvent.createMany({
    data: leadIds.map((leadId) => ({
      leadId,
      kind: EMAIL_SENT_JOURNEY_EVENT,
      metadata: { campaignId: campaign.id, campaignName: campaign.name },
    })),
  });
}

export async function sendNextEmailBatch(campaignId: string): Promise<{ hasMore: boolean }> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      subject: true,
      previewText: true,
      bodyHtml: true,
      replyTo: true,
    },
  });
  if (!campaign) return { hasMore: false };

  const recipients = await prisma.emailCampaignRecipient.findMany({
    where: { campaignId, status: "pending" },
    orderBy: { id: "asc" },
    take: BATCH_SIZE,
  });
  if (recipients.length === 0) return { hasMore: false };

  const organization = await prisma.organization.findUnique({
    where: { id: campaign.organizationId },
    select: { name: true },
  });
  const orgName = organization?.name ?? "Órbita";

  const unsubscribed = await prisma.emailUnsubscribe.findMany({
    where: {
      organizationId: campaign.organizationId,
      email: { in: recipients.map((recipient) => recipient.email) },
    },
    select: { email: true },
  });
  const unsubscribedEmails = new Set(unsubscribed.map((entry) => entry.email));

  const sendable = recipients.filter(
    (recipient) => EMAIL_PATTERN.test(recipient.email) && !unsubscribedEmails.has(recipient.email),
  );
  const skipped = recipients.filter((recipient) => !sendable.includes(recipient));
  if (skipped.length > 0) {
    for (const recipient of skipped) {
      await prisma.emailCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "skipped",
          error: unsubscribedEmails.has(recipient.email) ? "Pediu para não receber" : "Email inválido",
        },
      });
    }
  }

  if (sendable.length > 0) {
    const layoutHtml = await renderCampaignLayout({
      previewText: campaign.previewText || campaign.subject,
      orgName,
    });
    const from = resolveSenderAddress(orgName);
    const emails = sendable.map((recipient) => {
      const unsubscribeUrl = buildUnsubscribeUrl(campaign.organizationId, recipient.email);
      const personalized = personalizeEmail({
        layoutHtml,
        bodyHtml: campaign.bodyHtml,
        subject: campaign.subject,
        context: { name: recipient.name, email: recipient.email, orgName },
        unsubscribeUrl,
      });
      return {
        from,
        to: recipient.email,
        subject: personalized.subject,
        html: personalized.html,
        ...(campaign.replyTo ? { replyTo: campaign.replyTo } : {}),
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    const result = await resend.batch.send(emails);
    if (result.error) {
      throw new Error(`Resend recusou o lote: ${result.error.message}`);
    }
    const providerIds = result.data?.data ?? [];
    const sentAt = new Date();
    for (const [index, recipient] of sendable.entries()) {
      await prisma.emailCampaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "sent", sentAt, providerId: providerIds[index]?.id ?? null },
      });
    }
    await markLeadsReached(
      campaign.organizationId,
      campaign,
      sendable.flatMap((recipient) => (recipient.leadId ? [recipient.leadId] : [])),
    );
  }

  const remaining = await prisma.emailCampaignRecipient.count({
    where: { campaignId, status: "pending" },
  });
  return { hasMore: remaining > 0 };
}

export async function finishEmailCampaign(campaignId: string) {
  const counts = await prisma.emailCampaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });
  const countOf = (status: string) =>
    counts.find((entry) => entry.status === status)?._count._all ?? 0;
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: "sent",
      sentCount: countOf("sent"),
      failedCount: countOf("failed") + countOf("pending"),
      skippedCount: countOf("skipped"),
      finishedAt: new Date(),
    },
  });
}

export async function failEmailCampaign(campaignId: string, message: string) {
  await prisma.emailCampaignRecipient.updateMany({
    where: { campaignId, status: "pending" },
    data: { status: "failed", error: message.slice(0, 300) },
  });
  await finishEmailCampaign(campaignId);
  await prisma.emailCampaign.update({ where: { id: campaignId }, data: { status: "failed" } });
}
