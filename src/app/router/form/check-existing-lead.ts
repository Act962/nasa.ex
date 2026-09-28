import { base } from "@/app/middlewares/base";
import { optionalAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Mod 1: informa, de forma discreta, se um telefone já pertence a um lead na
 * base da org do formulário. Usa `optionalAuthMiddleware` — visitante anônimo
 * (form público) recebe sempre `{ exists: false }`, sem vazar nada. Só um
 * MEMBRO autenticado da org do form vê o resultado real. O client só chama
 * quando há sessão (ver FormSubmitComponent).
 */
export const checkExistingLead = base
  .use(optionalAuthMiddleware)
  .route({
    method: "POST",
    path: "/forms/:formId/check-existing-lead",
    summary: "Checa (para membro autenticado) se o telefone já é um lead da org",
  })
  .input(
    z.object({
      formId: z.string(),
      phone: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const notFound = { exists: false as const };

    if (!context.user || !input.phone.trim()) return notFound;

    const form = await prisma.form.findUnique({
      where: { id: input.formId },
      select: {
        organizationId: true,
        settings: { select: { trackingId: true } },
      },
    });
    if (!form) return notFound;

    const isMember = await prisma.member.findUnique({
      where: {
        userId_organizationId: {
          userId: context.user.id,
          organizationId: form.organizationId,
        },
      },
      select: { id: true },
    });
    if (!isMember) return notFound;

    const lead = await prisma.lead.findFirst({
      where: {
        phone: input.phone,
        tracking: { organizationId: form.organizationId },
      },
      select: {
        id: true,
        trackingId: true,
        tracking: { select: { name: true } },
        status: { select: { name: true } },
      },
    });
    if (!lead) return notFound;

    return {
      exists: true as const,
      currentTrackingName: lead.tracking?.name ?? null,
      currentStatusName: lead.status?.name ?? null,
      isInFormTracking: lead.trackingId === form.settings?.trackingId,
    };
  });
