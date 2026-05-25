import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { requireCourseManager } from "../utils";

/**
 * Cria ou atualiza um plano. No `create`, se nenhuma `lessonIds` é informada,
 * o plano nasce vazio (criador adiciona aulas via `creatorSetPlanLessons`).
 */
export const creatorUpsertPlan = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string().optional(),
      courseId: z.string().min(1),
      name: z.string().min(1).max(80),
      description: z.string().max(500).optional().nullable(),
      priceStars: z.number().int().min(0).default(0),
      // Preço em centavos BRL — fonte de verdade para Stripe Checkout.
      // 0 = plano gratuito; valor pago precisa ser >= 50 (R$ 0,50 mínimo Stripe).
      priceBrlCents: z.number().int().min(0).default(0),
      order: z.number().int().min(0).optional(),
      isDefault: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    if (input.priceBrlCents > 0 && input.priceBrlCents < 50) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Valor mínimo aceito pelo gateway é R$ 0,50.",
      });
    }
    await requireCourseManager(context.user.id, input.courseId);

    if (input.id) {
      const existing = await prisma.nasaRoutePlan.findUnique({
        where: { id: input.id },
        select: { id: true, courseId: true, isDefault: true },
      });
      if (!existing || existing.courseId !== input.courseId) {
        throw new ORPCError("NOT_FOUND", { message: "Plano não encontrado" });
      }

      const updated = await prisma.nasaRoutePlan.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description ?? null,
          priceStars: input.priceStars,
          priceBrlCents: input.priceBrlCents,
          ...(input.order !== undefined ? { order: input.order } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        },
      });

      // Garantir que apenas 1 plano default por curso.
      if (input.isDefault === true) {
        await prisma.nasaRoutePlan.updateMany({
          where: {
            courseId: input.courseId,
            isDefault: true,
            id: { not: input.id },
          },
          data: { isDefault: false },
        });
      }

      return { plan: updated };
    }

    const order =
      input.order ??
      (await prisma.nasaRoutePlan.count({ where: { courseId: input.courseId } }));

    const willBeDefault = input.isDefault === true;
    if (willBeDefault) {
      await prisma.nasaRoutePlan.updateMany({
        where: { courseId: input.courseId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await prisma.nasaRoutePlan.create({
      data: {
        courseId: input.courseId,
        name: input.name,
        description: input.description ?? null,
        priceStars: input.priceStars,
        priceBrlCents: input.priceBrlCents,
        order,
        isDefault: willBeDefault,
      },
    });

    return { plan: created };
  });
