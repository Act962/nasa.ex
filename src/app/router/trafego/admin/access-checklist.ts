import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { parseAccessChecklist } from "@/features/trafego/lib/release";

/** Os acessos viraram tarefa da equipe no setup (spec 0126, RF-7, D-2): só admin marca. */
export const updateTrafegoAccessChecklistAdmin = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      orderId: z.string().min(1),
      items: z.record(z.string().max(40), z.boolean()),
    }),
  )
  .handler(async ({ input }) => {
    const order = await prisma.trafegoOrder.findUnique({ where: { id: input.orderId }, select: { id: true } });
    if (!order) throw new ORPCError("NOT_FOUND", { message: "Pedido não encontrado." });
    await prisma.trafegoOrder.update({
      where: { id: order.id },
      data: { accessChecklist: parseAccessChecklist(input.items) as unknown as object },
    });
    return { success: true };
  });
