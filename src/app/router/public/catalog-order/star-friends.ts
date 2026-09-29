import { z } from "zod";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { findOrderByPublicToken } from "@/features/nerp-catalog/lib/portal-order";
import { findMemberForLead, getMemberBalance, getMemberLifetimeStars } from "@/features/star-friends/lib/members";
import { isTierReached, tierProgress } from "@/features/star-friends/utils/tiers";
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
    const [balance, lifetimeStars, rewards, redemptions, entries] = await Promise.all([
      member ? getMemberBalance(member.id) : Promise.resolve(0),
      member ? getMemberLifetimeStars(member.id) : Promise.resolve(0),
      prisma.loyaltyReward.findMany({
        where: { organizationId: order.organizationId, isActive: true },
        orderBy: { costStars: "asc" },
        select: {
          id: true,
          type: true,
          name: true,
          description: true,
          imageUrl: true,
          costStars: true,
          stock: true,
          minTier: true,
        },
      }),
      member
        ? prisma.loyaltyRedemption.findMany({
            where: { memberId: member.id },
            orderBy: { createdAt: "desc" },
            take: 30,
            select: { id: true, status: true, costStars: true, rewardSnapshot: true, createdAt: true },
          })
        : Promise.resolve([]),
      member
        ? prisma.loyaltyLedgerEntry.findMany({
            where: { memberId: member.id },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: { id: true, type: true, stars: true, itemsSnapshot: true, reason: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);
    const progress = tierProgress(lifetimeStars, program);
    return {
      isActive: true as const,
      programName: program.name,
      starsPerPurchase: program.starsPerPurchase,
      rules: program.rules,
      hasMember: !!member,
      balance,
      lifetimeStars,
      tier: progress,
      tiers: {
        moonMinStars: program.moonMinStars,
        galaxyMinStars: program.galaxyMinStars,
        earthPerks: program.earthPerks,
        moonPerks: program.moonPerks,
        galaxyPerks: program.galaxyPerks,
      },
      rewards: rewards.map((reward) => ({
        ...reward,
        isTierLocked: !isTierReached(progress.tier, reward.minTier),
      })),
      pendingRedemptions: redemptions.filter(
        (redemption) => redemption.status === "PENDING" || redemption.status === "APPROVED",
      ),
      redemptions,
      entries,
    };
  });

// Outros pedidos do mesmo cliente nesta loja (mesmo telefone): "Meus pedidos" do portal.
export const listPublicCustomerOrders = base
  .input(z.object({ token: z.string().min(16) }))
  .handler(async ({ input, errors }) => {
    const order = await findOrderByPublicToken(input.token);
    if (!order) throw errors.NOT_FOUND({ message: "Pedido não encontrado" });
    const lead = await prisma.lead.findUnique({ where: { id: order.leadId }, select: { phone: true } });
    const orders = await prisma.catalogOrder.findMany({
      where: {
        organizationId: order.organizationId,
        ...(lead?.phone ? { lead: { phone: lead.phone } } : { id: order.id }),
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { publicToken: true, nerpSaleNumber: true, status: true, total: true, createdAt: true },
    });
    return {
      orders: orders.map((customerOrder) => ({
        token: customerOrder.publicToken,
        saleNumber: customerOrder.nerpSaleNumber,
        status: customerOrder.status,
        total: Number(customerOrder.total),
        createdAt: customerOrder.createdAt,
        isCurrent: customerOrder.publicToken === input.token,
      })),
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
