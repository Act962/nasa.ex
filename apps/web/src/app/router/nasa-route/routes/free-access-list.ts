import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { isCourseManager } from "../utils";

/** Lista entries de acesso livre da org ativa. */
export const freeAccessList = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ courseId: z.string().optional() }))
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;
    const userId = context.user.id;

    const ok = await isCourseManager(userId, orgId);
    if (!ok) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas owner/moderador pode gerenciar acesso livre",
      });
    }

    const entries = await prisma.nasaRouteFreeAccess.findMany({
      where: {
        creatorOrgId: orgId,
        ...(input.courseId ? { courseId: input.courseId } : {}),
      },
      orderBy: { grantedAt: "desc" },
      select: {
        id: true,
        grantedAt: true,
        note: true,
        user: { select: { id: true, name: true, email: true, image: true } },
        course: { select: { id: true, slug: true, title: true } },
        grantedBy: { select: { id: true, name: true } },
      },
    });

    return { entries };
  });
