import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email/resend";
import {
  personalizeEmail,
  renderCampaignLayout,
  resolveSenderAddress,
  templateBodyToHtml,
} from "@/features/campanhas/email/render-email";
import { buildUnsubscribeUrl } from "@/features/campanhas/email/unsubscribe-token";
import { emailTemplateInputSchema } from "./_shared";

// Spec 0107 (RF-1): modelos de email da empresa.

export const listEmailTemplates = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("contatos", "canView"))
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const templates = await prisma.emailTemplate.findMany({
      where: { organizationId: context.org.id, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, subject: true, previewText: true, bodyJson: true, updatedAt: true },
    });
    return { templates };
  });

export const saveEmailTemplate = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("contatos", "canEdit"))
  .input(emailTemplateInputSchema.extend({ id: z.string().optional() }))
  .handler(async ({ context, input }) => {
    const data = {
      name: input.name,
      subject: input.subject,
      previewText: input.previewText ?? null,
      bodyJson: input.bodyJson as Prisma.InputJsonValue,
    };
    if (input.id) {
      const updated = await prisma.emailTemplate.updateMany({
        where: { id: input.id, organizationId: context.org.id, archivedAt: null },
        data,
      });
      if (updated.count === 0) throw new ORPCError("NOT_FOUND", { message: "Modelo não encontrado." });
      return { id: input.id };
    }
    const created = await prisma.emailTemplate.create({
      data: { ...data, organizationId: context.org.id, createdById: context.user.id },
      select: { id: true },
    });
    return { id: created.id };
  });

export const archiveEmailTemplate = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("contatos", "canEdit"))
  .input(z.object({ id: z.string() }))
  .handler(async ({ context, input }) => {
    await prisma.emailTemplate.updateMany({
      where: { id: input.id, organizationId: context.org.id },
      data: { archivedAt: new Date() },
    });
    return { ok: true };
  });

/** Envia o modelo, como está na tela, para o email de quem está editando. */
export const sendTestEmail = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("contatos", "canEdit"))
  .input(emailTemplateInputSchema.omit({ name: true }))
  .handler(async ({ context, input }) => {
    const to = context.user.email;
    if (!to) throw new ORPCError("BAD_REQUEST", { message: "Seu usuário não tem email." });
    const orgName = context.org.name;
    const layoutHtml = await renderCampaignLayout({
      previewText: input.previewText || input.subject,
      orgName,
    });
    const email = personalizeEmail({
      layoutHtml,
      bodyHtml: templateBodyToHtml(input.bodyJson),
      subject: `[Teste] ${input.subject}`,
      context: { name: context.user.name ?? to, email: to, orgName },
      unsubscribeUrl: buildUnsubscribeUrl(context.org.id, to),
    });
    const result = await resend.emails.send({
      from: resolveSenderAddress(orgName),
      to,
      subject: email.subject,
      html: email.html,
    });
    if (result.error) throw new ORPCError("BAD_GATEWAY", { message: result.error.message });
    return { to };
  });
