import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { requireCourseManager } from "../utils";

export const creatorDeletePlan = base
  .use(requiredAuthMiddleware)
  .input(z.object({ planId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const plan = await prisma.nasaRoutePlan.findUnique({
      where: { id: input.planId },
      select: {
        id: true,
        courseId: true,
        isDefault: true,
        _count: { select: { enrollments: true } },
      },
    });
    if (!plan) {
      throw new ORPCError("NOT_FOUND", { message: "Plano não encontrado" });
    }

    await requireCourseManager(context.user.id, plan.courseId);

    if (plan._count.enrollments > 0) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Este plano já tem alunos matriculados e não pode ser excluído. Edite-o ou crie um novo.",
      });
    }

    const totalPlans = await prisma.nasaRoutePlan.count({
      where: { courseId: plan.courseId },
    });
    if (totalPlans <= 1) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Cada curso precisa ter ao menos um plano. Crie outro antes de excluir este.",
      });
    }

    await prisma.nasaRoutePlan.delete({ where: { id: input.planId } });

    // Se removemos o default, promover o de menor `order` a default.
    if (plan.isDefault) {
      const next = await prisma.nasaRoutePlan.findFirst({
        where: { courseId: plan.courseId },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      if (next) {
        await prisma.nasaRoutePlan.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    return { ok: true as const };
  });
