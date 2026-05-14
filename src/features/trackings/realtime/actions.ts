"use server";

import { headers } from "next/headers";
import { boardLeadsChannel } from "@/inngest/channels/board-leads";
import { inngest } from "@/inngest/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getSubscriptionToken, type Realtime } from "@inngest/realtime";

export type BoardLeadsToken = Realtime.Token<
  typeof boardLeadsChannel,
  ["lead-moved", "lead-changed", "lead-closed"]
>;

export async function fetchBoardLeadsRealtimeToken(
  trackingId: string,
): Promise<BoardLeadsToken> {
  if (!trackingId) {
    throw new Error("trackingId is required");
  }

  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const org = await auth.api.getFullOrganization({ headers: reqHeaders });
  if (!org?.id) {
    throw new Error("Forbidden");
  }

  // Membership: tracking precisa pertencer à org ativa do usuário. Sem este
  // check, qualquer usuário autenticado conseguiria assinar qualquer board.
  const tracking = await prisma.tracking.findUnique({
    where: { id: trackingId, organizationId: org.id },
    select: { id: true },
  });
  if (!tracking) {
    throw new Error("Forbidden");
  }

  return getSubscriptionToken(inngest, {
    channel: boardLeadsChannel(trackingId),
    topics: ["lead-moved", "lead-changed", "lead-closed"],
  });
}
