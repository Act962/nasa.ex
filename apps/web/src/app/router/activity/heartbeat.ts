import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const heartbeat = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z
      .object({
        activeAppSlug: z.string().optional(),
        activePath: z.string().optional(),
        activeResource: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ input, context }) => {
    const { user, org } = context;
    await prisma.userPresence.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: {
        lastSeenAt: new Date(),
        userName: user.name,
        userEmail: user.email,
        userImage: (user as any).image ?? null,
        ...(input?.activeAppSlug !== undefined ? { activeAppSlug: input.activeAppSlug } : {}),
        ...(input?.activePath !== undefined ? { activePath: input.activePath } : {}),
        ...(input?.activeResource !== undefined ? { activeResource: input.activeResource } : {}),
      },
      create: {
        organizationId: org.id,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userImage: (user as any).image ?? null,
        lastSeenAt: new Date(),
        activeAppSlug: input?.activeAppSlug ?? null,
        activePath: input?.activePath ?? null,
        activeResource: input?.activeResource ?? null,
      },
    });
    return { ok: true };
  });
