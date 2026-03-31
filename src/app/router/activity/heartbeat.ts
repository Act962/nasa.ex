import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const heartbeat = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const { user, org } = context;
    await prisma.userPresence.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: {
        lastSeenAt: new Date(),
        userName: user.name,
        userEmail: user.email,
        userImage: (user as any).image ?? null,
      },
      create: {
        organizationId: org.id,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userImage: (user as any).image ?? null,
        lastSeenAt: new Date(),
      },
    });
    return { ok: true };
  });
