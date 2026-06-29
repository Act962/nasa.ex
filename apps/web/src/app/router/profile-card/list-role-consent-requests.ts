import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";

/**
 * Lista OrgRoles onde o usuário foi adicionado e ainda não consentiu
 * (publicConsent=false). Usado no centro de notificações para mostrar
 * "você foi adicionado como <cargo> na <empresa>".
 */
export const listRoleConsentRequests = base
  .use(requiredAuthMiddleware)
  .handler(async ({ context }) => {
    const pending = await prisma.orgRole.findMany({
      where: {
        userId: context.user.id,
        publicConsent: false,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        department: true,
        customLabel: true,
        org: {
          select: { id: true, name: true, slug: true, logo: true },
        },
        jobTitle: {
          select: { id: true, title: true, category: true },
        },
      },
    });

    return pending;
  });
