import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { customAlphabet } from "nanoid";
import { CALENDAR_SHARE_TTL_MS } from "@/features/settings/lib/calendar-share";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";

const MODERATOR_ROLES = ["owner", "moderador"];
// Alfabeto sem chars ambíguos (0/O, 1/l, I) pra colar bem em qualquer fonte.
const TOKEN_ALPHABET =
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const nanoid = customAlphabet(TOKEN_ALPHABET, 12);

function buildShareUrl(slug: string, token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/calendario/equipe/${slug}/${token}`;
}

/**
 * Habilita compartilhamento público do Calendário Workspace pra org ativa.
 * Gera token random e expiração de 1h. Auditoria via logActivity.
 *
 * Requer owner/moderador da org. Body precisa ter `consent: true` (aceite
 * explícito do disclaimer — bloqueado no schema Zod, não dá pra burlar).
 */
export const enableCalendarShare = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      // Refine força true — qualquer outro valor (false, undefined) rejeita.
      consent: z
        .boolean()
        .refine((v) => v === true, { message: "Consentimento obrigatório" }),
    }),
  )
  .handler(async ({ context }) => {
    const userId = context.user.id;
    const orgId = context.org.id;

    const member = await prisma.member.findFirst({
      where: { organizationId: orgId, userId },
      select: { role: true },
    });
    if (!member || !MODERATOR_ROLES.includes(member.role)) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas owner/moderador pode ativar compartilhamento",
      });
    }

    // Cobra Stars antes (regra global "calendar_share_enable")
    const charge = await chargeStarsByAction(orgId, "calendar_share_enable", {
      userId,
      description: "Calendário público — ativação de link",
      appSlug: "calendar",
    });
    if (!charge.skipped && !charge.success) {
      throw new ORPCError("PRECONDITION_FAILED", {
        message: "Saldo de Stars insuficiente pra ativar o link público.",
      });
    }

    const token = nanoid();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CALENDAR_SHARE_TTL_MS);

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        calendarPublicEnabled: true,
        calendarPublicToken: token,
        calendarPublicExpiresAt: expiresAt,
        calendarPublicEnabledAt: now,
        calendarPublicEnabledBy: userId,
        calendarPublicConsentAt: now,
      },
      select: { slug: true },
    });

    await logActivity({
      organizationId: orgId,
      userId,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: context.user.image,
      appSlug: "settings",
      subAppSlug: "calendar-share",
      action: "org.calendar_share.enabled",
      actionLabel: "Ativou compartilhamento público do calendário",
      featureKey: "calendar.share.enable",
      metadata: { expiresAt: expiresAt.toISOString() },
    });

    return {
      shareUrl: buildShareUrl(org.slug, token),
      expiresAt,
    };
  });
