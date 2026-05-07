import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import prisma from "@/lib/prisma";
import { getProgramSettings } from "@/features/partner/lib/partner-service";

const adminBase = base.use(requireAdminMiddleware);

const SettingsZ = z.object({
  suiteThreshold: z.number().int().min(1),
  earthThreshold: z.number().int().min(1),
  galaxyThreshold: z.number().int().min(1),
  constellationThreshold: z.number().int().min(1),
  infinityThreshold: z.number().int().min(1),
  suiteCommissionRate: z.number().min(0).max(100),
  earthCommissionRate: z.number().min(0).max(100),
  galaxyCommissionRate: z.number().min(0).max(100),
  constellationCommissionRate: z.number().min(0).max(100),
  infinityCommissionRate: z.number().min(0).max(100),
  suiteDiscountRate: z.number().min(0).max(100),
  earthDiscountRate: z.number().min(0).max(100),
  galaxyDiscountRate: z.number().min(0).max(100),
  constellationDiscountRate: z.number().min(0).max(100),
  infinityDiscountRate: z.number().min(0).max(100),
  payoutDayOfMonth: z.number().int().min(1).max(28),
  advanceFeePercent: z.number().min(0).max(100),
  advanceMinDaysBefore: z.number().int().min(0),
  activeOrgWindowDays: z.number().int().min(7),
  activeOrgMinPurchaseBrl: z.number().min(0),
  activeOrgMinStarsConsumed: z.number().int().min(0),
  atRiskWarningDays: z.number().int().min(0),
  downgradeGracePeriodDays: z.number().int().min(0),
  tierRecalcCadenceDays: z.number().int().min(1),
});

export const getSettings = adminBase
  .route({
    method: "GET",
    summary: "Admin — Settings do programa de parceiros",
    tags: ["Admin", "Partner"],
  })
  .output(SettingsZ)
  .handler(async () => {
    const s = await getProgramSettings();
    return {
      suiteThreshold: s.suiteThreshold,
      earthThreshold: s.earthThreshold,
      galaxyThreshold: s.galaxyThreshold,
      constellationThreshold: s.constellationThreshold,
      infinityThreshold: s.infinityThreshold,
      suiteCommissionRate: Number(s.suiteCommissionRate),
      earthCommissionRate: Number(s.earthCommissionRate),
      galaxyCommissionRate: Number(s.galaxyCommissionRate),
      constellationCommissionRate: Number(s.constellationCommissionRate),
      infinityCommissionRate: Number(s.infinityCommissionRate),
      suiteDiscountRate: Number(s.suiteDiscountRate),
      earthDiscountRate: Number(s.earthDiscountRate),
      galaxyDiscountRate: Number(s.galaxyDiscountRate),
      constellationDiscountRate: Number(s.constellationDiscountRate),
      infinityDiscountRate: Number(s.infinityDiscountRate),
      payoutDayOfMonth: s.payoutDayOfMonth,
      advanceFeePercent: Number(s.advanceFeePercent),
      advanceMinDaysBefore: s.advanceMinDaysBefore,
      activeOrgWindowDays: s.activeOrgWindowDays,
      activeOrgMinPurchaseBrl: Number(s.activeOrgMinPurchaseBrl),
      activeOrgMinStarsConsumed: s.activeOrgMinStarsConsumed,
      atRiskWarningDays: s.atRiskWarningDays,
      downgradeGracePeriodDays: s.downgradeGracePeriodDays,
      tierRecalcCadenceDays: s.tierRecalcCadenceDays,
    };
  });

export const updateSettings = adminBase
  .route({
    method: "POST",
    summary: "Admin — Atualiza settings do programa de parceiros",
    tags: ["Admin", "Partner"],
  })
  .input(SettingsZ)
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input }) => {
    await getProgramSettings();
    await prisma.partnerProgramSettings.update({
      where: { id: "singleton" },
      data: input,
    });
    return { success: true };
  });
