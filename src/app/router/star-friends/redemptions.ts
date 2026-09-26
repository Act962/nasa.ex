import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  approveRedemption,
  cancelRedemption,
  deliverRedemption,
  rejectRedemption,
  requestRedemption,
} from "@/features/star-friends/lib/redemptions";
import { userActor } from "@/features/star-friends/lib/actor";
import { starFriendsProcedure, toRuleMessage } from "./_base";

const redemptionSelect = {
  id: true,
  status: true,
  costStars: true,
  rewardSnapshot: true,
  requestedVia: true,
  requestedByType: true,
  requestedByName: true,
  note: true,
  decidedByName: true,
  decidedAt: true,
  decisionReason: true,
  deliveredByName: true,
  deliveredAt: true,
  leadId: true,
  createdAt: true,
  member: { select: { id: true, name: true, phone: true } },
} as const;

export const listStarFriendsRedemptions = starFriendsProcedure
  .input(
    z.object({
      status: z.enum(["PENDING", "APPROVED", "DELIVERED", "REJECTED", "CANCELED"]).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const redemptions = await prisma.loyaltyRedemption.findMany({
      where: { organizationId: context.org.id, ...(input.status ? { status: input.status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: redemptionSelect,
    });
    return { redemptions };
  });

async function runRule<T>(action: () => Promise<T>, onRuleError: (message: string) => Error): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const message = toRuleMessage(error);
    if (message) throw onRuleError(message);
    throw error;
  }
}

export const requestStarFriendsRedemption = starFriendsProcedure
  .input(
    z.object({
      leadId: z.string(),
      rewardId: z.string(),
      channel: z.enum(["CONSULTANT", "CHAT"]),
      note: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) =>
    runRule(
      async () => {
        const redemption = await requestRedemption({
          organizationId: context.org.id,
          leadId: input.leadId,
          rewardId: input.rewardId,
          channel: input.channel,
          actor: userActor(context.user),
          note: input.note,
        });
        return { id: redemption.id, status: redemption.status };
      },
      (message) => errors.BAD_REQUEST({ message }),
    ),
  );

const decisionInput = z.object({ redemptionId: z.string(), reason: z.string().trim().min(3).max(500).optional() });

export const decideStarFriendsRedemption = starFriendsProcedure
  .input(decisionInput.extend({ decision: z.enum(["APPROVE", "REJECT", "DELIVER", "CANCEL"]) }))
  .handler(async ({ input, context, errors }) =>
    runRule(
      async () => {
        const actor = userActor(context.user);
        const organizationId = context.org.id;
        const reason = input.reason ?? "";
        if ((input.decision === "REJECT" || input.decision === "CANCEL") && reason.length < 3) {
          throw errors.BAD_REQUEST({ message: "Informe o motivo." });
        }
        const handlers = {
          APPROVE: () => approveRedemption({ organizationId, redemptionId: input.redemptionId, actor }),
          REJECT: () => rejectRedemption({ organizationId, redemptionId: input.redemptionId, actor, reason }),
          DELIVER: () => deliverRedemption({ organizationId, redemptionId: input.redemptionId, actor }),
          CANCEL: () => cancelRedemption({ organizationId, redemptionId: input.redemptionId, actor, reason }),
        } as const;
        const redemption = await handlers[input.decision]();
        return { id: redemption.id, status: redemption.status };
      },
      (message) => errors.BAD_REQUEST({ message }),
    ),
  );
