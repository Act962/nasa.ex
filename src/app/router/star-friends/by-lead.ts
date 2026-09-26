import { z } from "zod";
import prisma from "@/lib/prisma";
import { findMemberForLead, getMemberBalance } from "@/features/star-friends/lib/members";
import { getActiveProgram } from "@/features/star-friends/lib/program";
import { adjustStars } from "@/features/star-friends/lib/adjust";
import { userActor } from "@/features/star-friends/lib/actor";
import { starFriendsWith, toRuleMessage } from "./_base";
import { hasAppPermission } from "@/features/permissions/server/app-permission";
import { STAR_FRIENDS_APP_SLUG } from "@/features/star-friends/lib/constants";

export const getStarFriendsByLead = starFriendsWith("canView")
  .input(z.object({ leadId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, tracking: { organizationId } },
      select: { id: true, phone: true },
    });
    if (!lead) throw errors.NOT_FOUND({ message: "Lead não encontrado" });

    const program = await getActiveProgram(organizationId);
    if (!program) return { isActive: false as const };

    const [member, rewards] = await Promise.all([
      findMemberForLead(organizationId, input.leadId),
      prisma.loyaltyReward.findMany({
        where: { organizationId, isActive: true },
        orderBy: { costStars: "asc" },
      }),
    ]);
    const [balance, entries, redemptions] = member
      ? await Promise.all([
          getMemberBalance(member.id),
          prisma.loyaltyLedgerEntry.findMany({
            where: { memberId: member.id },
            orderBy: { createdAt: "desc" },
            take: 30,
          }),
          prisma.loyaltyRedemption.findMany({
            where: { memberId: member.id },
            orderBy: { createdAt: "desc" },
            take: 20,
          }),
        ])
      : [0, [], []];

    return {
      isActive: true as const,
      hasPhone: !!lead.phone,
      programName: program.name,
      member: member ? { id: member.id, name: member.name, phone: member.phone } : null,
      balance,
      entries: entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        stars: entry.stars,
        source: entry.source,
        itemsSnapshot: entry.itemsSnapshot,
        reason: entry.reason,
        actorType: entry.actorType,
        actorName: entry.actorName,
        createdAt: entry.createdAt,
      })),
      redemptions: redemptions.map((redemption) => ({
        id: redemption.id,
        status: redemption.status,
        costStars: redemption.costStars,
        rewardSnapshot: redemption.rewardSnapshot,
        requestedVia: redemption.requestedVia,
        requestedByName: redemption.requestedByName,
        decidedByName: redemption.decidedByName,
        deliveredByName: redemption.deliveredByName,
        createdAt: redemption.createdAt,
      })),
      rewards: rewards.map((reward) => ({
        id: reward.id,
        type: reward.type,
        name: reward.name,
        description: reward.description,
        imageUrl: reward.imageUrl,
        costStars: reward.costStars,
        stock: reward.stock,
      })),
    };
  });

export const adjustStarFriendsStars = starFriendsWith("canView")
  .input(z.object({ leadId: z.string(), stars: z.number().int(), reason: z.string().trim().min(5).max(500) }))
  .handler(async ({ input, context, errors }) => {
    // Lançar stars = Criar; retirar stars = Excluir.
    const requiredAction = input.stars > 0 ? "canCreate" : "canDelete";
    const isAllowed = await hasAppPermission(context.org.id, context.user.id, STAR_FRIENDS_APP_SLUG, requiredAction);
    if (!isAllowed) {
      throw errors.FORBIDDEN({ message: "Seu papel não pode ajustar stars do STAR FRIENDS." });
    }
    try {
      const entry = await adjustStars({
        organizationId: context.org.id,
        leadId: input.leadId,
        stars: input.stars,
        reason: input.reason,
        actor: userActor(context.user),
      });
      return { id: entry.id };
    } catch (error) {
      const message = toRuleMessage(error);
      if (message) throw errors.BAD_REQUEST({ message });
      throw error;
    }
  });
