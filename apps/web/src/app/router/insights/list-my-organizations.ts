import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";

export const listMyOrganizations = base
  .use(requiredAuthMiddleware)
  .handler(async ({ context }) => {
    const memberships = await prisma.member.findMany({
      where: { userId: context.user.id },
      select: {
        role: true,
        organization: {
          select: { id: true, name: true, logo: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        logo: m.organization.logo,
        role: m.role,
      })),
    };
  });
