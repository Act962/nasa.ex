import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { requireOrgAdmin } from "../../_access";

const periodTypeSchema = z.enum([
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
]);

const DEFAULT_ACTIVE_PERIOD_TYPES = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
] as const;

const prizeSchema = z.object({
  position: z.number().int().min(1).max(4),
  label: z.string().min(1),
  imageUrl: z.string().url().optional(),
});

const updateSalesGoalRankingSettingsInputSchema = z.object({
  displayName: z.string().min(1).optional(),
  theme: z.enum(["GAMING", "LIGHT", "DARK", "GALAXY"]).optional(),
  activePeriodTypes: z.array(periodTypeSchema).min(1).optional(),
  soundEnabled: z.boolean().optional(),
  // Aceita URL completa (link colado pelo admin) OU o id de um preset
  // sintetizado (ex: "score-ding") — ver sales-goal-sound-presets.ts.
  scoreSoundUrl: z.string().min(1).nullable().optional(),
  overtakeSoundUrl: z.string().min(1).nullable().optional(),
  victorySoundUrl: z.string().min(1).nullable().optional(),
  soundVolume: z.number().min(0).max(1).optional(),
  prizes: z.array(prizeSchema).max(4).optional(),
});

export const updateSalesGoalRankingSettings = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(updateSalesGoalRankingSettingsInputSchema)
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    return prisma.salesGoalRankingSettings.upsert({
      where: { organizationId: context.org.id },
      create: {
        organizationId: context.org.id,
        displayName: input.displayName,
        theme: input.theme,
        activePeriodTypes: input.activePeriodTypes ?? [...DEFAULT_ACTIVE_PERIOD_TYPES],
        soundEnabled: input.soundEnabled,
        scoreSoundUrl: input.scoreSoundUrl,
        overtakeSoundUrl: input.overtakeSoundUrl,
        victorySoundUrl: input.victorySoundUrl,
        soundVolume: input.soundVolume,
        prizes: input.prizes,
      },
      update: {
        displayName: input.displayName,
        theme: input.theme,
        activePeriodTypes: input.activePeriodTypes,
        soundEnabled: input.soundEnabled,
        scoreSoundUrl: input.scoreSoundUrl,
        overtakeSoundUrl: input.overtakeSoundUrl,
        victorySoundUrl: input.victorySoundUrl,
        soundVolume: input.soundVolume,
        prizes: input.prizes,
      },
    });
  });
