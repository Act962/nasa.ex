import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  getBalancesForMembers,
  getLastActivityForMembers,
  getLifetimeStarsForMembers,
} from "@/features/star-friends/lib/members";
import { resolveTier } from "@/features/star-friends/utils/tiers";
import { maskPhone } from "@/features/star-friends/utils/live-draw";
import { userActor } from "@/features/star-friends/lib/actor";
import { auditLoyaltyAction } from "@/features/star-friends/lib/audit";
import { starFriendsWith } from "./_base";

const MEMBERS_PAGE_SIZE = 30;

export const listStarFriendsMembers = starFriendsWith("canView")
  .input(z.object({ search: z.string().optional(), cursor: z.string().optional() }))
  .handler(async ({ input, context }) => {
    const search = input.search?.trim();
    const members = await prisma.loyaltyMember.findMany({
      where: {
        organizationId: context.org.id,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search.replace(/\D/g, "") || search } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: MEMBERS_PAGE_SIZE + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const page = members.slice(0, MEMBERS_PAGE_SIZE);
    const memberIds = page.map((member) => member.id);
    const [balances, lifetimeStarsByMember, lastActivityByMember, program] = await Promise.all([
      getBalancesForMembers(memberIds),
      getLifetimeStarsForMembers(memberIds),
      getLastActivityForMembers(memberIds),
      prisma.loyaltyProgram.findUnique({
        where: { organizationId: context.org.id },
        select: { moonMinStars: true, galaxyMinStars: true },
      }),
    ]);
    return {
      members: page.map((member) => ({
        id: member.id,
        name: member.name,
        phone: member.phone,
        lastLeadId: member.lastLeadId,
        balance: balances.get(member.id) ?? 0,
        joinedAt: member.createdAt,
        tier: program ? resolveTier(lifetimeStarsByMember.get(member.id) ?? 0, program) : null,
        lastActivityAt: lastActivityByMember.get(member.id) ?? null,
      })),
      nextCursor: members.length > MEMBERS_PAGE_SIZE ? page[page.length - 1]?.id : null,
    };
  });

// Exclui o participante com extrato, resgates, cupons e números da sorte (spec 0134). Ganhador de
// sorteio não sai: o sorteio precisa ser revogado antes, no prazo de 30 minutos.
export const deleteStarFriendsMember = starFriendsWith("canDelete")
  .input(z.object({ memberId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.loyaltyMember.findFirst({
      where: { id: input.memberId, organizationId: context.org.id },
      select: { id: true, name: true, phone: true, lastLeadId: true },
    });
    if (!member) throw errors.NOT_FOUND({ message: "Participante não encontrado." });
    const activeWin = await prisma.loyaltyCampaignDraw.findFirst({ where: { memberId: member.id, revokedAt: null }, select: { position: true } });
    if (activeWin) {
      throw errors.BAD_REQUEST({ message: `Este participante foi sorteado (${activeWin.position}º prêmio). Revogue o sorteio antes de excluir.` });
    }
    const [receipts, luckyNumbers] = await Promise.all([
      prisma.loyaltyReceipt.count({ where: { memberId: member.id } }),
      prisma.loyaltyLuckyNumber.count({ where: { memberId: member.id } }),
    ]);
    await prisma.loyaltyMember.delete({ where: { id: member.id } });
    await auditLoyaltyAction({
      organizationId: context.org.id,
      actor: userActor(context.user),
      action: "member.deleted",
      actionLabel: `Participante ${member.name} (${maskPhone(member.phone)}) excluído com ${receipts} cupom(ns) e ${luckyNumbers} número(s) da sorte`,
      leadId: member.lastLeadId,
      resourceId: member.id,
      metadata: { receipts, luckyNumbers },
    });
    return { ok: true as const };
  });
