import "server-only";

import prisma from "@/lib/prisma";

/** A empresa já pagou o setup de algum pedido (spec 0126, RF-8): não paga de novo. */
export async function hasOrgPaidTrafegoSetup(organizationId: string): Promise<boolean> {
  const order = await prisma.trafegoOrder.findFirst({
    where: { organizationId, setupFeeBrlCents: { gt: 0 }, status: { notIn: ["REFUNDED"] } },
    select: { id: true },
  });
  return Boolean(order);
}
