import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requirePartnerMiddleware } from "@/app/middlewares/partner";
import prisma from "@/lib/prisma";
import { getProgramSettings } from "@/features/partner/lib/partner-service";

const partnerBase = base.use(requirePartnerMiddleware);

const StatusZ = z.enum(["PENDING", "READY", "PAID", "CANCELLED"]);

export const listCommissions = partnerBase
  .route({
    method: "GET",
    summary: "Partner — Lista comissões",
    tags: ["Partner"],
  })
  .input(
    z.object({
      status: StatusZ.optional(),
      cycleYearMonth: z.string().optional(),
      limit: z.coerce.number().int().positive().max(200).default(50),
    }),
  )
  .output(
    z.object({
      commissions: z.array(
        z.object({
          id: z.string(),
          createdAt: z.string(),
          organizationName: z.string(),
          packageLabel: z.string(),
          starsAmount: z.number(),
          unitPriceBrl: z.number(),
          basePaymentBrl: z.number(),
          ratePercent: z.number(),
          commissionBrl: z.number(),
          tier: z.string(),
          cycleYearMonth: z.string(),
          status: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const rows = await prisma.partnerCommission.findMany({
      where: {
        partnerId: context.partner.id,
        ...(input.status ? { status: input.status } : {}),
        ...(input.cycleYearMonth
          ? { cycleYearMonth: input.cycleYearMonth }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      include: {
        organization: { select: { name: true } },
      },
    });
    return {
      commissions: rows.map((c) => ({
        id: c.id,
        createdAt: c.createdAt.toISOString(),
        organizationName: c.organization.name,
        packageLabel: c.packageLabelSnapshot,
        starsAmount: c.starsAmountSnapshot,
        unitPriceBrl: Number(c.unitPriceBrlSnapshot),
        basePaymentBrl: Number(c.basePaymentBrl),
        ratePercent: Number(c.ratePercent),
        commissionBrl: Number(c.commissionBrl),
        tier: c.tierAtMoment,
        cycleYearMonth: c.cycleYearMonth,
        status: c.status,
      })),
    };
  });

export const listPayouts = partnerBase
  .route({
    method: "GET",
    summary: "Partner — Lista payouts",
    tags: ["Partner"],
  })
  .output(
    z.object({
      payouts: z.array(
        z.object({
          id: z.string(),
          cycleYearMonth: z.string(),
          scheduledFor: z.string(),
          grossBrl: z.number(),
          advanceFeeBrl: z.number(),
          netBrl: z.number(),
          status: z.string(),
          paidAt: z.string().nullable(),
          commissionsCount: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const rows = await prisma.partnerPayout.findMany({
      where: { partnerId: context.partner.id },
      orderBy: { cycleYearMonth: "desc" },
      include: { _count: { select: { commissions: true } } },
    });
    return {
      payouts: rows.map((p) => ({
        id: p.id,
        cycleYearMonth: p.cycleYearMonth,
        scheduledFor: p.scheduledFor.toISOString(),
        grossBrl: Number(p.grossBrl),
        advanceFeeBrl: Number(p.advanceFeeBrl),
        netBrl: Number(p.netBrl),
        status: p.status,
        paidAt: p.paidAt?.toISOString() ?? null,
        commissionsCount: p._count.commissions,
      })),
    };
  });

export const requestAdvance = partnerBase
  .route({
    method: "POST",
    summary: "Partner — Solicita antecipação de payout",
    tags: ["Partner"],
  })
  .input(z.object({ payoutId: z.string() }))
  .output(
    z.object({
      success: z.boolean(),
      grossBrl: z.number(),
      advanceFeeBrl: z.number(),
      netBrl: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const payout = await prisma.partnerPayout.findUnique({
      where: { id: input.payoutId },
    });
    if (!payout) throw errors.NOT_FOUND({ message: "Payout não encontrado" });
    if (payout.partnerId !== context.partner.id) {
      throw errors.FORBIDDEN({ message: "Payout não pertence ao parceiro" });
    }
    if (payout.status !== "SCHEDULED") {
      throw errors.BAD_REQUEST({
        message: "Apenas payouts SCHEDULED podem ser antecipados",
      });
    }

    const settings = await getProgramSettings();
    const minDaysBefore = settings.advanceMinDaysBefore;
    const daysUntil = Math.floor(
      (payout.scheduledFor.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );
    if (daysUntil < minDaysBefore) {
      throw errors.BAD_REQUEST({
        message: `Antecipação só permitida com mínimo de ${minDaysBefore} dias antes do repasse`,
      });
    }

    const feePercent = Number(settings.advanceFeePercent);
    const advanceFeeBrl =
      Math.round(Number(payout.grossBrl) * feePercent) / 100;
    const netBrl = Number(payout.grossBrl) - advanceFeeBrl;

    await prisma.partnerPayout.update({
      where: { id: input.payoutId },
      data: {
        status: "ADVANCED",
        advanceFeeBrl,
        netBrl,
      },
    });

    return {
      success: true,
      grossBrl: Number(payout.grossBrl),
      advanceFeeBrl,
      netBrl,
    };
  });
