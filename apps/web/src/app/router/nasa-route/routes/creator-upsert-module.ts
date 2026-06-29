import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { requireCourseManager } from "../utils";

export const creatorUpsertModule = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string().optional(),
      courseId: z.string().min(1),
      title: z.string().min(2).max(120),
      summary: z.string().max(500).optional().nullable(),
      order: z.number().int().min(0).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireCourseManager(context.user.id, input.courseId);

    if (input.id) {
      const existing = await prisma.nasaRouteModule.findUnique({
        where: { id: input.id },
        select: { courseId: true },
      });
      if (!existing || existing.courseId !== input.courseId) {
        throw new ORPCError("NOT_FOUND", { message: "Módulo não encontrado" });
      }
      const updated = await prisma.nasaRouteModule.update({
        where: { id: input.id },
        data: {
          title: input.title,
          summary: input.summary ?? null,
          ...(input.order !== undefined ? { order: input.order } : {}),
        },
      });
      return { module: updated };
    }

    const order =
      input.order ??
      (await prisma.nasaRouteModule.count({ where: { courseId: input.courseId } }));

    const created = await prisma.nasaRouteModule.create({
      data: {
        courseId: input.courseId,
        title: input.title,
        summary: input.summary ?? null,
        order,
      },
    });
    return { module: created };
  });
