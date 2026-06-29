import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";

function buildShareUrl(slug: string, token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/calendario/equipe/${slug}/${token}`;
}

/**
 * Estado atual do compartilhamento — usado pela seção de Configurações
 * pra renderizar toggle, contador regressivo e info de quem ativou.
 *
 * Não exige owner/moderador — qualquer membro da org pode consultar
 * (a info é pública dentro da org).
 */
export const getCalendarShareStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const orgId = context.org.id;

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: {
        slug: true,
        calendarPublicEnabled: true,
        calendarPublicToken: true,
        calendarPublicExpiresAt: true,
        calendarPublicEnabledAt: true,
        calendarPublicEnabledBy: true,
      },
    });

    const expiresAt = org.calendarPublicExpiresAt;
    const expired = !!expiresAt && expiresAt.getTime() < Date.now();
    const isLive =
      org.calendarPublicEnabled && !!org.calendarPublicToken && !expired;

    let enabledByName: string | null = null;
    if (org.calendarPublicEnabledBy) {
      const user = await prisma.user.findUnique({
        where: { id: org.calendarPublicEnabledBy },
        select: { name: true },
      });
      enabledByName = user?.name ?? null;
    }

    return {
      enabled: org.calendarPublicEnabled,
      shareUrl:
        isLive && org.calendarPublicToken
          ? buildShareUrl(org.slug, org.calendarPublicToken)
          : null,
      expiresAt: expiresAt ?? null,
      expired,
      enabledAt: org.calendarPublicEnabledAt,
      enabledByName,
    };
  });
