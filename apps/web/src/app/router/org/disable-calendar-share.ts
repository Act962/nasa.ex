import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { logActivity } from "@/features/admin/lib/activity-logger";

const MODERATOR_ROLES = ["owner", "moderador"];

/**
 * Desabilita compartilhamento público. Token zerado → URL antiga retorna
 * 404 imediatamente. Mantém metadata de quem desativou via logActivity.
 */
export const disableCalendarShare = base
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
        message: "Apenas owner/moderador pode desativar compartilhamento",
      });
    }

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        calendarPublicEnabled: false,
        calendarPublicToken: null,
        calendarPublicExpiresAt: null,
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
      action: "org.calendar_share.disabled",
      actionLabel: "Desativou compartilhamento público do calendário",
      featureKey: "calendar.share.disable",
    });

    return { success: true };
  });
