"use server";

import { headers } from "next/headers";
import { boardActionsChannel } from "@/inngest/channels/board-actions";
import { inngest } from "@/inngest/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getSubscriptionToken, type Realtime } from "@inngest/realtime";

export type BoardActionsToken = Realtime.Token<
  typeof boardActionsChannel,
  ["action-moved", "action-changed", "action-archived", "sub-action-created"]
>;

export async function fetchBoardActionsRealtimeToken(
  workspaceId: string,
): Promise<BoardActionsToken> {
  if (!workspaceId) {
    throw new Error("workspaceId is required");
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

  // Membership: workspace precisa pertencer à org ativa do usuário. Sem este
  // check, qualquer usuário autenticado conseguiria assinar qualquer board.
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId, organizationId: org.id },
    select: { id: true },
  });
  if (!workspace) {
    throw new Error("Forbidden");
  }

  return getSubscriptionToken(inngest, {
    channel: boardActionsChannel(workspaceId),
    topics: [
      "action-moved",
      "action-changed",
      "action-archived",
      "sub-action-created",
    ],
  });
}
