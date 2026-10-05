import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createChannelGateway } from "@/modules/social";
import { commentsProcedure, repositoriesFor, requireOrgAdmin } from "./_shared";
import { getInstagramLeadTracking, setInstagramLeadTracking } from "@/features/comments/server/lead-tracking";

/**
 * O que o Comments lê e configura **de uma conta**. Conectar, reconectar e
 * desativar contas mora em `socialAccounts.*` (spec 0069, D-4).
 */

const channelIdInput = z.object({ channelId: z.string().min(1) });

/** Tracking que recebe os leads desta conta no tracking-chat (spec 0062; por conta na 0069, RF-16). */
export const getLeadTracking = commentsProcedure
  .input(channelIdInput)
  .handler(async ({ context, input }) => getInstagramLeadTracking(context.org.id, input.channelId));

export const setLeadTracking = commentsProcedure
  .input(channelIdInput.extend({ trackingId: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    return setInstagramLeadTracking(context.org.id, input.channelId, input.trackingId);
  });

/** Publicações da conta, para o passo "escolha o post" do editor. */
export const listContent = commentsProcedure
  .input(channelIdInput.extend({ cursor: z.string().optional() }))
  .handler(async ({ context, input }) => {
    const { channels } = repositoriesFor(context.org.id);
    const channel = await channels.findWithCredentialsById(input.channelId);

    if (!channel) {
      throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada." });
    }

    if (channel.status !== "ACTIVE") {
      return {
        items: [],
        nextCursor: undefined as string | undefined,
        needsReconnect: true,
      };
    }

    const page = await createChannelGateway(channel).listContent({
      cursor: input.cursor,
    });

    return { ...page, needsReconnect: false };
  });
