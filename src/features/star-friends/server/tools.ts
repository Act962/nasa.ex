import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { findMemberForLead, getMemberBalance } from "../lib/members";
import { LoyaltyRuleError, requestRedemption } from "../lib/redemptions";
import { ASTRO_ACTOR } from "../lib/actor";

type StarFriendsToolContext = { organizationId: string; leadId: string; programName: string };

export function makeStarFriendsTools(ctx: StarFriendsToolContext): ToolSet {
  return {
    get_star_friends_balance: tool({
      description: `Consulta o saldo de stars do cliente no programa de fidelidade ${ctx.programName} e a lista de prêmios disponíveis para troca.`,
      inputSchema: z.object({}),
      execute: async () => {
        const member = await findMemberForLead(ctx.organizationId, ctx.leadId);
        const [balance, rewards] = await Promise.all([
          member ? getMemberBalance(member.id) : Promise.resolve(0),
          prisma.loyaltyReward.findMany({
            where: { organizationId: ctx.organizationId, isActive: true },
            orderBy: { costStars: "asc" },
            select: { id: true, name: true, type: true, costStars: true, stock: true },
          }),
        ]);
        return { balance, rewards };
      },
    }),
    request_star_friends_redemption: tool({
      description:
        "Registra o pedido de troca de stars por um prêmio. O pedido fica PENDENTE até um atendente aprovar — diga isso ao cliente. Use só depois de o cliente escolher o prêmio e confirmar.",
      inputSchema: z.object({ rewardId: z.string().describe("ID do prêmio escolhido") }),
      execute: async ({ rewardId }) => {
        try {
          const redemption = await requestRedemption({
            organizationId: ctx.organizationId,
            leadId: ctx.leadId,
            rewardId,
            channel: "ASTRO",
            actor: ASTRO_ACTOR,
          });
          return { ok: true, status: redemption.status };
        } catch (error) {
          if (error instanceof LoyaltyRuleError) return { ok: false, error: error.message };
          throw error;
        }
      },
    }),
  };
}
