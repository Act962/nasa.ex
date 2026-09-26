import { z } from "zod";
import prisma from "@/lib/prisma";
import { auditLoyaltyAction } from "@/features/star-friends/lib/audit";
import { userActor } from "@/features/star-friends/lib/actor";
import { starFriendsWith } from "./_base";

export const upsertStarFriendsProgram = starFriendsWith("canEdit")
  .input(
    z.object({
      isActive: z.boolean(),
      name: z.string().trim().min(2).max(60),
      starsPerPurchase: z.number().int().min(1).max(100),
      minPurchaseAmount: z.number().min(0),
      starsExpireDays: z.number().int().min(1).max(3650).nullable(),
      countCatalogOrders: z.boolean(),
      countForgeProposals: z.boolean(),
      rules: z.string().max(4000).nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;
    await prisma.loyaltyProgram.upsert({
      where: { organizationId },
      create: { organizationId, ...input },
      update: input,
    });
    await auditLoyaltyAction({
      organizationId,
      actor: userActor(context.user),
      action: "program.updated",
      actionLabel: `Atualizou as regras do programa (${input.starsPerPurchase} star por compra, mínimo R$ ${input.minPurchaseAmount})`,
      metadata: {
        isActive: input.isActive,
        starsPerPurchase: input.starsPerPurchase,
        minPurchaseAmount: input.minPurchaseAmount,
        starsExpireDays: input.starsExpireDays,
      },
    });
    return { saved: true };
  });
