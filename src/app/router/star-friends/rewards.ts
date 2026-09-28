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
