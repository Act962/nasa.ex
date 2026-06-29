import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { requireCourseManager } from "../utils";

/** Reordena módulos de um curso (batch update de `order`). */
export const creatorReorderModules = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      courseId: z.string().min(1),
      modules: z
        .array(
          z.object({
            id: z.string().min(1),
            order: z.number().int().min(0),
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireCourseManager(context.user.id, input.courseId);

    const ids = input.modules.map((m) => m.id);
    const owned = await prisma.nasaRouteModule.findMany({
      where: { id: { in: ids }, courseId: input.courseId },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Um ou mais módulos não pertencem ao curso informado.",
      });
    }

    await prisma.$transaction(
      input.modules.map((m) =>
        prisma.nasaRouteModule.update({
          where: { id: m.id },
          data: { order: m.order },
        }),
      ),
    );
    return { ok: true };
  });
