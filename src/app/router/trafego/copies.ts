import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { assertOrderEditable } from "@/features/trafego/server/lib/assert-order-editable";
import { trafegoCopyInputSchema } from "@/features/trafego/schema/trafego-schemas";

export const addTrafegoCopy = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(trafegoCopyInputSchema.extend({ orderId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const order = await assertOrderEditable(input.orderId, context.org.id);

    if (order.copiesCount >= order.maxCopies) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Seu plano permite até ${order.maxCopies} variações de copy.`,
      });
    }

    const last = await prisma.trafegoCopy.findFirst({
      where: { orderId: order.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    return prisma.trafegoCopy.create({
      data: {
        orderId: order.id,
        headline: input.headline,
        primaryText: input.primaryText,
        description: input.description,
        callToAction: input.callToAction,
        source: "CLIENT",
        // A primeira copy já nasce selecionada — evita o cliente travar no
        // botão Ativar sem entender que precisava marcar alguma.
        isSelected: order.copiesCount === 0,
        position: (last?.position ?? -1) + 1,
      },
      select: { id: true, position: true, isSelected: true },
    });
  });

export const updateTrafegoCopy = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(trafegoCopyInputSchema.partial().extend({ copyId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const copy = await loadOwnedCopy(input.copyId, context.org.id);
    await assertOrderEditable(copy.orderId, context.org.id);

    return prisma.trafegoCopy.update({
      where: { id: copy.id },
      data: {
        headline: input.headline,
        primaryText: input.primaryText,
        description: input.description,
        callToAction: input.callToAction,
      },
      select: { id: true },
    });
  });

export const setTrafegoCopySelected = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ copyId: z.string().min(1), isSelected: z.boolean() }))
  .handler(async ({ input, context }) => {
    const copy = await loadOwnedCopy(input.copyId, context.org.id);
    await assertOrderEditable(copy.orderId, context.org.id);

    await prisma.trafegoCopy.update({
      where: { id: copy.id },
      data: { isSelected: input.isSelected },
    });
    return { success: true };
  });

export const removeTrafegoCopy = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ copyId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const copy = await loadOwnedCopy(input.copyId, context.org.id);
    await assertOrderEditable(copy.orderId, context.org.id);

    await prisma.trafegoCopy.delete({ where: { id: copy.id } });
    return { success: true };
  });

async function loadOwnedCopy(copyId: string, organizationId: string) {
  const copy = await prisma.trafegoCopy.findFirst({
    where: { id: copyId, order: { organizationId } },
    select: { id: true, orderId: true },
  });
  if (!copy) {
    throw new ORPCError("NOT_FOUND", { message: "Copy não encontrada." });
  }
  return copy;
}
