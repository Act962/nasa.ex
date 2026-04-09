import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateSupportTicketStatus = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string(),
      status: z.enum(["PENDING", "IN_PROGRESS", "RESOLVED", "REJECTED"]),
    })
  )
  .handler(async ({ input }) => {
    const { id, status } = input;

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { status },
    });

    return ticket;
  });
