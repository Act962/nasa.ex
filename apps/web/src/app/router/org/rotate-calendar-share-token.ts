import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { customAlphabet } from "nanoid";
import { CALENDAR_SHARE_TTL_MS } from "@/features/settings/lib/calendar-share";
import { logActivity } from "@/features/admin/lib/activity-logger";

const MODERATOR_ROLES = ["owner", "moderador"];
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
 * Gera novo token + reseta expiração pra +1h. URL antiga vira inválida
 * imediatamente (token único na coluna). Sem disclaimer adicional —
 * pressupõe que o user já consentiu em enableCalendarShare.
 *
 * Pré-condição: compartilhamento precisa estar `enabled=true`.
 */
export const rotateCalendarShareToken = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const userId = context.user.id;
    const orgId = context.org.id;

    const member = await prisma.member.findFirst({
      where: { organizationId: orgId, userId },
      select: { role: true },
    });
    if (!member || !MODERATOR_ROLES.includes(member.role)) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas owner/moderador pode rotacionar o link",
      });
    }

    const current = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { slug: true, calendarPublicEnabled: true },
    });
    if (!current.calendarPublicEnabled) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Compartilhamento não está ativo. Ative em vez de rotacionar.",
      });
    }

    const token = nanoid();
    const expiresAt = new Date(Date.now() + CALENDAR_SHARE_TTL_MS);

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        calendarPublicToken: token,
        calendarPublicExpiresAt: expiresAt,
      },
    });

    await logActivity({
      organizationId: orgId,
      userId,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: context.user.image,
      appSlug: "settings",
      subAppSlug: "calendar-share",
      action: "org.calendar_share.rotated",
      actionLabel: "Rotacionou link de compartilhamento do calendário",
      featureKey: "calendar.share.rotate",
      metadata: { expiresAt: expiresAt.toISOString() },
    });

    return {
      shareUrl: buildShareUrl(current.slug, token),
      expiresAt,
    };
  });
