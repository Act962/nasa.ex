import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listSupportTickets = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      page: z.number().optional().default(1),
      take: z.number().optional().default(10),
    })
  )
  .handler(async ({ input }) => {
    const { page, take } = input;
    const skip = (page - 1) * take;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.supportTicket.count(),
    ]);

    return {
      tickets,
      total,
      totalPages: Math.ceil(total / take) || 1,
    };
  });
