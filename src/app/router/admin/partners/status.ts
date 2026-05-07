import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";
import { recalcPartnerTier } from "@/features/partner/lib/partner-service";
import { PartnerStatus } from "@/generated/prisma/client";

const adminBase = base.use(requireAdminMiddleware);

export const suspendPartner = adminBase
  .route({
    method: "POST",
    summary: "Admin — Suspende parceiro",
    tags: ["Admin", "Partner"],
  })
  .input(z.object({ partnerId: z.string(), reason: z.string().optional() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors }) => {
    const partner = await prisma.partner.findUnique({
      where: { id: input.partnerId },
    });
    if (!partner) throw errors.NOT_FOUND({ message: "Parceiro não encontrado" });
    await prisma.partner.update({
      where: { id: input.partnerId },
      data: {
        status: PartnerStatus.SUSPENDED,
        notes: input.reason
          ? `${partner.notes ?? ""}\n[suspended] ${input.reason}`.trim()
          : partner.notes,
      },
    });
    return { success: true };
  });

export const reactivatePartner = adminBase
  .route({
    method: "POST",
    summary: "Admin — Reativa parceiro suspenso",
    tags: ["Admin", "Partner"],
  })
  .input(z.object({ partnerId: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors, context }) => {
    const partner = await prisma.partner.findUnique({
      where: { id: input.partnerId },
    });
    if (!partner) throw errors.NOT_FOUND({ message: "Parceiro não encontrado" });
    await prisma.partner.update({
      where: { id: input.partnerId },
      data: {
        status: partner.tier ? PartnerStatus.ACTIVE : PartnerStatus.ELIGIBLE,
      },
    });
    await recalcPartnerTier(partner.id, {
      triggeredById: context.adminUser.id,
    });
    return { success: true };
  });

export const recalcTier = adminBase
  .route({
    method: "POST",
    summary: "Admin — Força recálculo de nível",
    tags: ["Admin", "Partner"],
  })
  .input(z.object({ partnerId: z.string() }))
  .output(
    z.object({
      fromTier: z.string().nullable(),
      toTier: z.string().nullable(),
      activeReferrals: z.number(),
      reason: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const result = await recalcPartnerTier(input.partnerId, {
      triggeredById: context.adminUser.id,
    });
    return {
      fromTier: result.fromTier,
      toTier: result.toTier,
      activeReferrals: result.activeReferrals,
      reason: result.reason,
    };
  });
