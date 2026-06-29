import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { requireCourseManager } from "../utils";

export const creatorDeletePlanAttachment = base
  .use(requiredAuthMiddleware)
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const att = await prisma.nasaRoutePlanAttachment.findUnique({
      where: { id: input.id },
      select: { id: true, plan: { select: { courseId: true } } },
    });
    if (!att) throw new ORPCError("NOT_FOUND", { message: "Anexo não encontrado" });

    await requireCourseManager(context.user.id, att.plan.courseId);

    await prisma.nasaRoutePlanAttachment.delete({ where: { id: input.id } });

    return { ok: true as const };
  });
