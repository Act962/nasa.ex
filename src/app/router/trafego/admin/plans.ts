import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { computeTrafegoPrice } from "@/features/trafego/lib/pricing";
import { trafegoPlanInputSchema } from "@/features/trafego/schema/trafego-schemas";

export const listTrafegoPlansAdmin = base
  .use(requireAdminMiddleware)
  .input(z.object({}).optional())
  .handler(async () => {
    const plans = await prisma.trafegoPlan.findMany({
      orderBy: [{ platform: "asc" }, { position: "asc" }],
      include: { _count: { select: { orders: true } } },
    });

    return plans.map((plan) => {
      const price = computeTrafegoPrice({
        adBudgetBrlCents: plan.adBudgetBrlCents,
        serviceFeePercent: Number(plan.serviceFeePercent),
        serviceFeeBrlCents: plan.serviceFeeBrlCents,
      });
      return {
        ...plan,
        serviceFeePercent: Number(plan.serviceFeePercent),
        computedServiceFeeBrlCents: price.serviceFeeBrlCents,
        totalBrlCents: price.totalBrlCents,
        ordersCount: plan._count.orders,
      };
    });
  });

export const createTrafegoPlan = base
  .use(requireAdminMiddleware)
  .input(trafegoPlanInputSchema)
  .handler(async ({ input }) => {
    const taken = await prisma.trafegoPlan.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (taken) {
      throw new ORPCError("BAD_REQUEST", { message: "Já existe um plano com esse slug." });
    }

    return prisma.trafegoPlan.create({
      data: { ...input, serviceFeeBrlCents: input.serviceFeeBrlCents ?? null },
      select: { id: true, slug: true },
    });
  });

export const updateTrafegoPlan = base
  .use(requireAdminMiddleware)
  .input(trafegoPlanInputSchema.partial().extend({ planId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const { planId, ...data } = input;

    if (data.slug) {
      const taken = await prisma.trafegoPlan.findFirst({
        where: { slug: data.slug, id: { not: planId } },
        select: { id: true },
      });
      if (taken) {
        throw new ORPCError("BAD_REQUEST", { message: "Já existe um plano com esse slug." });
      }
    }

    return prisma.trafegoPlan.update({
      where: { id: planId },
      data,
      select: { id: true },
    });
  });

export const toggleTrafegoPlanActive = base
  .use(requireAdminMiddleware)
  .input(z.object({ planId: z.string().min(1), isActive: z.boolean() }))
  .handler(async ({ input }) => {
    await prisma.trafegoPlan.update({
      where: { id: input.planId },
      data: { isActive: input.isActive },
    });
    return { success: true };
  });

export const deleteTrafegoPlan = base
  .use(requireAdminMiddleware)
  .input(z.object({ planId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const plan = await prisma.trafegoPlan.findUnique({
      where: { id: input.planId },
      select: { _count: { select: { orders: true, pendingPurchases: true } } },
    });
    if (!plan) {
      throw new ORPCError("NOT_FOUND", { message: "Plano não encontrado." });
    }
    // Plano vendido não some: apagá-lo apagaria a prova do que foi cobrado nas
    // compras pendentes (o FK é Restrict). Desativar é o caminho.
    if (plan._count.orders > 0 || plan._count.pendingPurchases > 0) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "Este plano já foi vendido e não pode ser excluído. Desative-o para tirá-lo do catálogo.",
      });
    }

    await prisma.trafegoPlan.delete({ where: { id: input.planId } });
    return { success: true };
  });
