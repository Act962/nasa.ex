import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { templateBodyToHtml } from "@/features/campanhas/email/render-email";
import { EMAIL_CAMPAIGN_SEND_EVENT } from "@/features/campanhas/email/send-campaign-batch";
import { MAX_EMAIL_RECIPIENTS } from "./_shared";

// Spec 0107 (RF-2/RF-3/RF-6): disparo de email para os contatos selecionados.

const leadIdsSchema = z.array(z.string().min(1)).min(1).max(MAX_EMAIL_RECIPIENTS);

/** Só leads da empresa entram; id de outra empresa some aqui (segurança). */
async function loadAudience(organizationId: string, leadIds: string[]) {
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds }, tracking: { organizationId } },
    select: { id: true, name: true, email: true },
  });
  const byEmail = new Map<string, { leadId: string; name: string; email: string }>();
  let withoutEmail = 0;
  for (const lead of leads) {
    const email = lead.email?.trim().toLowerCase();
    if (!email) {
      withoutEmail += 1;
      continue;
    }
    if (!byEmail.has(email)) byEmail.set(email, { leadId: lead.id, name: lead.name, email });
  }
  const unsubscribed = await prisma.emailUnsubscribe.findMany({
    where: { organizationId, email: { in: [...byEmail.keys()] } },
    select: { email: true },
  });
  for (const entry of unsubscribed) byEmail.delete(entry.email);
  return {
    recipients: [...byEmail.values()],
    withoutEmail,
    unsubscribed: unsubscribed.length,
    duplicates: leads.length - withoutEmail - byEmail.size - unsubscribed.length,
  };
}

export const emailAudienceSummary = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("contatos", "canView"))
  .input(z.object({ leadIds: leadIdsSchema }))
  .handler(async ({ context, input }) => {
    const audience = await loadAudience(context.org.id, input.leadIds);
    return {
      withEmail: audience.recipients.length,
      withoutEmail: audience.withoutEmail,
      unsubscribed: audience.unsubscribed,
      duplicates: audience.duplicates,
    };
  });

export const createEmailCampaign = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("contatos", "canCreate"))
  .input(
    z.object({
      name: z.string().trim().min(1).max(80),
      templateId: z.string().min(1),
      leadIds: leadIdsSchema,
    }),
  )
  .handler(async ({ context, input }) => {
    const organizationId = context.org.id;
    const template = await prisma.emailTemplate.findFirst({
      where: { id: input.templateId, organizationId, archivedAt: null },
    });
    if (!template) throw new ORPCError("NOT_FOUND", { message: "Modelo de email não encontrado." });

    const audience = await loadAudience(organizationId, input.leadIds);
    if (audience.recipients.length === 0) {
      throw new ORPCError("BAD_REQUEST", { message: "Nenhum contato selecionado tem email para receber." });
    }

    const campaign = await prisma.emailCampaign.create({
      data: {
        organizationId,
        name: input.name,
        templateId: template.id,
        subject: template.subject,
        previewText: template.previewText,
        bodyHtml: templateBodyToHtml(template.bodyJson),
        totalRecipients: audience.recipients.length,
        replyTo: context.user.email ?? null,
        createdById: context.user.id,
        recipients: {
          createMany: {
            data: audience.recipients.map((recipient) => ({
              leadId: recipient.leadId,
              email: recipient.email,
              name: recipient.name,
            })),
            skipDuplicates: true,
          },
        },
      },
      select: { id: true, totalRecipients: true },
    });

    await inngest.send({ name: EMAIL_CAMPAIGN_SEND_EVENT, data: { campaignId: campaign.id } });
    return campaign;
  });

export const listEmailCampaigns = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("contatos", "canView"))
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const campaigns = await prisma.emailCampaign.findMany({
      where: { organizationId: context.org.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        subject: true,
        status: true,
        totalRecipients: true,
        sentCount: true,
        failedCount: true,
        skippedCount: true,
        createdAt: true,
      },
    });
    return { campaigns };
  });
