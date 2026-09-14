import { base } from "@/app/middlewares/base";
import { requireTrafegoOperatorMiddleware } from "@/app/middlewares/trafego-operator";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { normalizePixReference } from "@/features/trafego/lib/pix";

/** Fila de PIX aguardando comprovante — inclui os vencidos, que ainda contam. */
export const listTrafegoPendingPix = base
  .use(requireTrafegoOperatorMiddleware)
  .input(
    z
      .object({
        search: z.string().trim().max(120).optional(),
        includeExpired: z.boolean().default(true),
      })
      .optional(),
  )
  .handler(async ({ input }) => {
    const search = input?.search?.trim();
    const statuses = input?.includeExpired === false
      ? (["PENDING"] as const)
      : (["PENDING", "EXPIRED"] as const);

    const pendings = await prisma.trafegoPendingPurchase.findMany({
      where: {
        paymentMethod: "PIX",
        status: { in: [...statuses] },
        ...(search
          ? {
              OR: [
                { pixReference: normalizePixReference(search) },
                { email: { contains: search, mode: "insensitive" } },
                { companyName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search.replace(/\D/g, "") } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        pixReference: true,
        email: true,
        phone: true,
        companyName: true,
        platform: true,
        objective: true,
        amountBrlCents: true,
        adBudgetBrlCents: true,
        status: true,
        createdAt: true,
        pixExpiresAt: true,
        leadId: true,
      },
    });

    return pendings.map((pending) => ({
      ...pending,
      isExpired: Boolean(pending.pixExpiresAt && pending.pixExpiresAt < new Date()),
    }));
  });
