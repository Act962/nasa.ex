import { z } from "zod";
import prisma from "@/lib/prisma";
import { auditLoyaltyAction } from "@/features/star-friends/lib/audit";
import { userActor } from "@/features/star-friends/lib/actor";
import { starFriendsWith } from "./_base";

function serializeReward(reward: {
  id: string;
  type: "PRODUCT" | "DISCOUNT" | "PRIZE";
  name: string;
  description: string | null;
  imageUrl: string | null;
  costStars: number;
  discountValue: { toString(): string } | null;
  discountPercent: number | null;
  stock: number | null;
  minTier: "EARTH" | "MOON" | "GALAXY";
  isActive: boolean;
}) {
  return {
    id: reward.id,
    type: reward.type,
    name: reward.name,
    description: reward.description,
    imageUrl: reward.imageUrl,
    costStars: reward.costStars,
    discountValue: reward.discountValue ? Number(reward.discountValue) : null,
    discountPercent: reward.discountPercent,
    stock: reward.stock,
    minTier: reward.minTier,
    isActive: reward.isActive,
  };
}

export const listStarFriendsRewards = starFriendsWith("canView")
  .input(z.object({ onlyActive: z.boolean().optional() }).optional())
  .handler(async ({ input, context }) => {
    const rewards = await prisma.loyaltyReward.findMany({
      where: { organizationId: context.org.id, ...(input?.onlyActive ? { isActive: true } : {}) },
      orderBy: [{ isActive: "desc" }, { costStars: "asc" }],
    });
    return { rewards: rewards.map(serializeReward) };
  });

export const upsertStarFriendsReward = starFriendsWith("canEdit")
  .input(
    z.object({
      id: z.string().optional(),
      type: z.enum(["PRODUCT", "DISCOUNT", "PRIZE"]),
      name: z.string().trim().min(2).max(120),
      description: z.string().max(1000).nullable(),
      imageUrl: z.string().url().nullable(),
      costStars: z.number().int().min(1).max(100000),
      discountValue: z.number().min(0).nullable(),
      discountPercent: z.number().int().min(1).max(100).nullable(),
      stock: z.number().int().min(0).nullable(),
      // Opcional: o formulário antigo não manda e o prêmio segue para todos (Terra).
      minTier: z.enum(["EARTH", "MOON", "GALAXY"]).optional(),
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const { id, ...data } = input;
    if (id) {
      const existing = await prisma.loyaltyReward.findFirst({
        where: { id, organizationId },
        select: { id: true },
      });
      if (!existing) throw errors.NOT_FOUND({ message: "Prêmio não encontrado" });
    }
    const reward = id
      ? await prisma.loyaltyReward.update({ where: { id }, data })
      : await prisma.loyaltyReward.create({ data: { organizationId, ...data } });
    await auditLoyaltyAction({
      organizationId,
      actor: userActor(context.user),
      action: id ? "reward.updated" : "reward.created",
      actionLabel: `${id ? "Editou" : "Criou"} o prêmio "${reward.name}" (${reward.costStars} stars)`,
      resourceId: reward.id,
    });
    return serializeReward(reward);
  });

// Prêmio com resgate no histórico não some: vira inativo, para o extrato e os resgates seguirem legíveis.
export const deleteStarFriendsReward = starFriendsWith("canDelete")
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const reward = await prisma.loyaltyReward.findFirst({
      where: { id: input.id, organizationId },
      select: { id: true, name: true, _count: { select: { redemptions: true } } },
    });
    if (!reward) throw errors.NOT_FOUND({ message: "Prêmio não encontrado" });
    const hasHistory = reward._count.redemptions > 0;
    if (hasHistory) {
      await prisma.loyaltyReward.update({ where: { id: reward.id }, data: { isActive: false } });
    } else {
      await prisma.loyaltyReward.delete({ where: { id: reward.id } });
    }
    await auditLoyaltyAction({
      organizationId,
      actor: userActor(context.user),
      action: hasHistory ? "reward.deactivated" : "reward.deleted",
      actionLabel: hasHistory
        ? `Desativou o prêmio "${reward.name}" (tem resgates no histórico)`
        : `Excluiu o prêmio "${reward.name}"`,
      resourceId: reward.id,
    });
    return { isDeleted: !hasHistory, isDeactivated: hasHistory };
  });
