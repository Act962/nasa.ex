import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { debitStars } from "@/lib/star-service";
import { StarTransactionType } from "@/generated/prisma/enums";
import { awardPoints } from "@/app/router/space-point/utils";
import { logActivity } from "@/lib/activity-logger";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

const STARS_COST = 1;

function generateCompanyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "NASA-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export const createCampaign = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      title: z.string().min(1, "Título é obrigatório"),
      description: z.string().optional(),
      clientName: z.string().optional(),
      plannerId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      color: z.string().optional(),
      orgProjectId: z.string().optional(),
      campaignType: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    // Debitar STAR
    let debitResult: { success: boolean; newBalance: number };
    try {
      debitResult = await debitStars(
        context.org.id,
        STARS_COST,
        StarTransactionType.APP_CHARGE,
        "Criar Planejamento de Campanha",
        "nasa-planner",
        context.user.id,
      );
    } catch (err: any) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: `Erro ao verificar saldo de STARs: ${err?.message ?? "tente novamente"}`,
      });
    }

    if (!debitResult.success) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Saldo de STARs insuficiente. Adquira mais STARs para criar um planejamento.",
      });
    }

    // Gerar company code único
    let companyCode = generateCompanyCode();
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.nasaCampaignPlanner.findUnique({ where: { companyCode } });
      if (!exists) break;
      companyCode = generateCompanyCode();
    }

    // Criar campanha
    const campaign = await prisma.nasaCampaignPlanner.create({
      data: {
        organizationId: context.org.id,
        userId: context.user.id,
        plannerId: input.plannerId || null,
        title: input.title,
        description: input.description ?? null,
        clientName: input.clientName ?? null,
        orgProjectId: input.orgProjectId ?? null,
        campaignType: input.campaignType ?? null,
        companyCode,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        color: input.color ?? null,
      },
    });

    // Criar onboarding e acesso público em paralelo
    await Promise.all([
      prisma.nasaCampaignOnboarding.create({
        data: { campaignPlannerId: campaign.id, responsibleUserId: context.user.id },
      }),
      prisma.nasaCampaignPublicAccess.create({
        data: { campaignPlannerId: campaign.id, accessCode: companyCode },
      }),
    ]);

    // Pontuar (best-effort)
    awardPoints(context.user.id, context.org.id, "create_campaign_planner").catch(() => {});

    // Log (best-effort)
    logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nasa-planner",
      action: "campaign.created",
      actionLabel: `Criou o planejamento "${campaign.title}"`,
      resource: campaign.title,
      resourceId: campaign.id,
    }).catch(() => {});

    return { campaign, starsSpent: STARS_COST, balanceAfter: debitResult.newBalance };
  });
