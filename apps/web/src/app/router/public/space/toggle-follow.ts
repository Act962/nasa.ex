import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

export const toggleFollow = base
  .use(requiredAuthMiddleware)
  .use(spaceVisibilityGuard)
  .input(z.object({ nick: z.string().min(1) }))
  .handler(async ({ context }) => {
    const { organization, user } = context;

    const existing = await prisma.orgFollow.findFirst({
      where: { orgId: organization.id, userId: user.id },
      select: { id: true },
    });

    if (existing) {
      await prisma.orgFollow.delete({ where: { id: existing.id } });
      return { isFollowing: false };
    }

    await prisma.orgFollow.create({
      data: { orgId: organization.id, userId: user.id },
    });

    return { isFollowing: true };
  });
