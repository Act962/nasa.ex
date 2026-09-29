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

// Níveis Terra/Lua/Galaxy (spec 0041): Terra começa em 0; Lua e Galaxy em ⭐ da vida toda.
export const upsertStarFriendsTiers = starFriendsWith("canEdit")
  .input(
    z
      .object({
        moonMinStars: z.number().int().min(1).max(100000),
        galaxyMinStars: z.number().int().min(2).max(100000),
        earthPerks: z.string().trim().max(500).nullable(),
        moonPerks: z.string().trim().max(500).nullable(),
        galaxyPerks: z.string().trim().max(500).nullable(),
      })
      .refine((tiers) => tiers.galaxyMinStars > tiers.moonMinStars, {
        message: "O Galaxy precisa de mais ⭐ que a Lua.",
        path: ["galaxyMinStars"],
      }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const program = await prisma.loyaltyProgram.findUnique({ where: { organizationId }, select: { id: true } });
    if (!program) throw errors.BAD_REQUEST({ message: "Instale o STAR FRIENDS antes de configurar os níveis." });
    await prisma.loyaltyProgram.update({ where: { organizationId }, data: input });
    await auditLoyaltyAction({
      organizationId,
      actor: userActor(context.user),
      action: "program.tiers_updated",
      actionLabel: `Atualizou os níveis: Lua a partir de ${input.moonMinStars} ⭐, Galaxy a partir de ${input.galaxyMinStars} ⭐`,
      metadata: { moonMinStars: input.moonMinStars, galaxyMinStars: input.galaxyMinStars },
    });
    return { saved: true };
  });
