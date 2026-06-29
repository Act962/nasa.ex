import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";

const adminBase = base.use(requireAdminMiddleware);

export const listPendingPayouts = adminBase
  .route({
    method: "GET",
    summary: "Admin — Lista payouts pendentes",
    tags: ["Admin", "Partner"],
  })
  .input(
    z.object({
      status: z
        .enum(["SCHEDULED", "ADVANCED", "PAID", "FAILED"])
        .default("SCHEDULED"),
      limit: z.coerce.number().int().positive().max(100).default(50),
    }),
  )
  .output(
    z.object({
      payouts: z.array(
        z.object({
          id: z.string(),
          partnerId: z.string(),
          partnerName: z.string(),
          partnerEmail: z.string(),
          cycleYearMonth: z.string(),
          scheduledFor: z.string(),
          grossBrl: z.number(),
          advanceFeeBrl: z.number(),
          netBrl: z.number(),
          status: z.string(),
          commissionsCount: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ input }) => {
    const rows = await prisma.partnerPayout.findMany({
      where: { status: input.status },
      take: input.limit,
      orderBy: { scheduledFor: "asc" },
      include: {
        partner: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
        _count: { select: { commissions: true } },
      },
    });

    return {
      payouts: rows.map((r) => ({
        id: r.id,
        partnerId: r.partnerId,
        partnerName: r.partner.user.name,
        partnerEmail: r.partner.user.email,
        cycleYearMonth: r.cycleYearMonth,
        scheduledFor: r.scheduledFor.toISOString(),
        grossBrl: Number(r.grossBrl),
        advanceFeeBrl: Number(r.advanceFeeBrl),
        netBrl: Number(r.netBrl),
        status: r.status,
        commissionsCount: r._count.commissions,
      })),
    };
  });

export const markPayoutPaid = adminBase
  .route({
    method: "POST",
    summary: "Admin — Marca payout como pago",
    tags: ["Admin", "Partner"],
  })
  .input(
    z.object({
      payoutId: z.string(),
      proofUrl: z.string().url().optional(),
      notes: z.string().optional(),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const payout = await prisma.partnerPayout.findUnique({
      where: { id: input.payoutId },
    });
    if (!payout) throw errors.NOT_FOUND({ message: "Payout não encontrado" });
    if (payout.status === "PAID") {
      throw errors.BAD_REQUEST({ message: "Payout já pago" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.partnerPayout.update({
        where: { id: input.payoutId },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paidByAdminId: context.adminUser.id,
          proofUrl: input.proofUrl ?? null,
          notes: input.notes ?? payout.notes,
        },
      });
      await tx.partnerCommission.updateMany({
        where: { payoutId: input.payoutId, status: { not: "CANCELLED" } },
        data: { status: "PAID" },
      });
      await tx.partner.update({
        where: { id: payout.partnerId },
        data: { totalPaidBrl: { increment: payout.netBrl } },
      });
    });

    return { success: true };
  });
