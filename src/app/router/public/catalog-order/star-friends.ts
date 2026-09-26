import { z } from "zod";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { findOrderByPublicToken } from "@/features/nerp-catalog/lib/portal-order";
import { findMemberForLead, getMemberBalance } from "@/features/star-friends/lib/members";
import { getActiveProgram } from "@/features/star-friends/lib/program";
import { LoyaltyRuleError, requestRedemption } from "@/features/star-friends/lib/redemptions";
import { customerActor } from "@/features/star-friends/lib/actor";

export const getPublicStarFriends = base
  .input(z.object({ token: z.string().min(16) }))
  .handler(async ({ input, errors }) => {
    const order = await findOrderByPublicToken(input.token);
    if (!order) throw errors.NOT_FOUND({ message: "Pedido não encontrado" });
    const program = await getActiveProgram(order.organizationId);
    if (!program) return { isActive: false as const };

    const member = await findMemberForLead(order.organizationId, order.leadId);
    const [balance, rewards, pendingRedemptions] = await Promise.all([
      member ? getMemberBalance(member.id) : Promise.resolve(0),
      prisma.loyaltyReward.findMany({
        where: { organizationId: order.organizationId, isActive: true },
        orderBy: { costStars: "asc" },
        select: { id: true, type: true, name: true, description: true, imageUrl: true, costStars: true, stock: true },
      }),
      member
        ? prisma.loyaltyRedemption.findMany({
            where: { memberId: member.id, status: { in: ["PENDING", "APPROVED"] } },
            orderBy: { createdAt: "desc" },
            select: { id: true, status: true, rewardSnapshot: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);
    return {
      isActive: true as const,
      programName: program.name,
      starsPerPurchase: program.starsPerPurchase,
      balance,
      rewards,
      pendingRedemptions,
    };
  });

// Pedido do cliente fica PENDENTE: um humano da loja aprova e as stars só
// saem do saldo na aprovação.
export const requestPublicStarFriendsRedemption = base
  .input(z.object({ token: z.string().min(16), rewardId: z.string() }))
  .handler(async ({ input, errors }) => {
    const order = await findOrderByPublicToken(input.token);
    if (!order) throw errors.NOT_FOUND({ message: "Pedido não encontrado" });
    const customer = order.customer as { name?: string };
    try {
      const redemption = await requestRedemption({
        organizationId: order.organizationId,
        leadId: order.leadId,
        rewardId: input.rewardId,
        channel: "PORTAL",
        actor: customerActor(customer.name ?? "Cliente"),
      });
      return { id: redemption.id, status: redemption.status };
    } catch (error) {
      if (error instanceof LoyaltyRuleError) throw errors.BAD_REQUEST({ message: error.message });
      throw error;
    }
  });
