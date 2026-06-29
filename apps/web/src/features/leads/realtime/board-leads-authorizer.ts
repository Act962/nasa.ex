import prisma from "@/lib/prisma";
import type { ChannelAuthorizer } from "@/lib/realtime/types";
import {
  BOARD_LEADS_CHANNEL_PREFIX,
  boardLeadsTrackingIdFromChannel,
} from "./board-leads-channel";

/**
 * Authorizer do canal `private-board-leads-{trackingId}`.
 *
 * Regra: qualquer **membro da organização dona do tracking** pode assinar —
 * NÃO é por autoria do tracking. Mesmo critério que o token Inngest fazia
 * antes (sessão + membership + tracking pertence à org).
 */
export const boardLeadsAuthorizer: ChannelAuthorizer = {
  matches(channel: string): boolean {
    return channel.startsWith(BOARD_LEADS_CHANNEL_PREFIX);
  },

  async authorize(channel: string, userId: string): Promise<boolean> {
    const trackingId = boardLeadsTrackingIdFromChannel(channel);
    if (!trackingId) return false;

    const tracking = await prisma.tracking.findUnique({
      where: { id: trackingId },
      select: { organizationId: true },
    });
    if (!tracking) return false;

    const member = await prisma.member.findFirst({
      where: { userId, organizationId: tracking.organizationId },
      select: { id: true },
    });
    return Boolean(member);
  },
};
