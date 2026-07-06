import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

const ALL_PERIOD_TYPES = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
] as const;

// Sem registro ainda? Devolve os defaults (nada persistido) pra UI já
// renderizar o formulário preenchido — evita side-effect de criar linha
// num GET.
export const getSalesGoalRankingSettings = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const settings = await prisma.salesGoalRankingSettings.findUnique({
      where: { organizationId: context.org.id },
    });

    if (!settings) {
      return {
        id: null,
        displayName: "Ranking de Equipes",
        theme: "GAMING" as const,
        activePeriodTypes: [...ALL_PERIOD_TYPES],
        soundEnabled: true,
        scoreSoundUrl: null,
        overtakeSoundUrl: null,
        victorySoundUrl: null,
        soundVolume: 0.6,
        prizes: [] as { position: number; label: string; imageUrl?: string }[],
      };
    }

    return {
      id: settings.id,
      displayName: settings.displayName,
      theme: settings.theme,
      activePeriodTypes: settings.activePeriodTypes,
      soundEnabled: settings.soundEnabled,
      scoreSoundUrl: settings.scoreSoundUrl,
      overtakeSoundUrl: settings.overtakeSoundUrl,
      victorySoundUrl: settings.victorySoundUrl,
      soundVolume: settings.soundVolume,
      prizes: settings.prizes as { position: number; label: string; imageUrl?: string }[],
    };
  });
